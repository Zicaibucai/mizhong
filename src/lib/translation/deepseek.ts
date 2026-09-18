import {
  parseTranslationResponse,
  TRANSLATION_SYSTEM_PROMPT,
  FIELD_LABELS_ZH,
  type TranslatableField,
  type TranslationRequest,
} from './fields';
import { buildUnitPrompt, parseUnitResponse, type BatchUnit } from './batch';
import { detectFormat } from './document';
import type { Locale } from '@/lib/i18n/config';
import type { TranslationSettings } from './settings';

/**
 * DeepSeek 客户端。
 *
 * **只允许在服务端调用**：API Key 保存在服务端，浏览器不能直接请求 DeepSeek。
 * 前端把中文原文交给项目的 Server Action，由后者在这里发起请求。
 *
 * 超时与重试策略：
 *   - 单次请求 60 秒超时；
 *   - 最多重试 2 次（共 3 次尝试），退避 1 秒 / 3 秒；
 *   - **只重试「可能自愈」的失败**：超时、网络错误、429、5xx。
 *     401/403（Key 不对）与 400（请求本身有问题）立刻返回，重试没有意义，
 *     只会拖长用户的等待时间。
 */

const REQUEST_TIMEOUT_MS = 60_000;
const MAX_ATTEMPTS = 3;
const BACKOFF_MS = [1_000, 3_000];

export type TranslationErrorKind =
  /** 后台还没配置 API Key */
  | 'not-configured'
  /** Key 无效或没有权限 */
  | 'auth'
  /** 触发限流 */
  | 'rate-limit'
  /** 超时 */
  | 'timeout'
  /** 网络不可达 */
  | 'network'
  /** DeepSeek 侧错误 */
  | 'server'
  /** 返回的内容不是预期结构 */
  | 'bad-response';

export type TranslationResult =
  | {
      ok: true;
      values: Record<string, Partial<Record<TranslatableField, string>>>;
      attempts: number;
    }
  | { ok: false; error: TranslationErrorKind; attempts: number; detail?: string };

/** 把失败归到有限几个类别，界面据此给出可执行的提示 */
function classify(status: number): TranslationErrorKind {
  if (status === 401 || status === 403) return 'auth';
  if (status === 429) return 'rate-limit';
  if (status >= 500) return 'server';
  return 'bad-response';
}

function retryable(kind: TranslationErrorKind): boolean {
  return kind === 'timeout' || kind === 'network' || kind === 'rate-limit' || kind === 'server';
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** 从 OpenAI 兼容的返回里取出 content 字符串 */
function extractContent(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null;
  const choices = (payload as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || choices.length === 0) return null;
  const message = (choices[0] as { message?: unknown }).message;
  if (!message || typeof message !== 'object') return null;
  const content = (message as { content?: unknown }).content;
  return typeof content === 'string' ? content : null;
}


/** 单次请求的结果：成功时带解析后的值，失败时带归类过的错误类别 */
type CallOutcome<T> =
  | { ok: true; value: T; attempts: number }
  | { ok: false; error: TranslationErrorKind; attempts: number; detail?: string };

/**
 * 调用 DeepSeek 的公共内核：超时、重试、错误归类、响应体提取。
 *
 * 抽出来是因为现在有两个入口 —— 管理员在编辑器里点的「一键翻译」，和后台长任务
 * 的分批同步。两者对**失败的处理**必须完全一致（哪些该重试、哪些立刻返回、
 * 日志里能出现什么），否则会出现「手动点能成、后台同步老是失败」这种解释不清的差异。
 */
async function callDeepSeek<T>(
  settings: TranslationSettings,
  userPrompt: string,
  parse: (decoded: unknown) => T | null,
  options: { timeoutMs?: number } = {},
): Promise<CallOutcome<T>> {
  if (!settings.apiKey) return { ok: false, error: 'not-configured', attempts: 0 };

  const timeoutMs = options.timeoutMs ?? REQUEST_TIMEOUT_MS;
  const url = `${settings.baseUrl.replace(/\/+$/, '')}/chat/completions`;
  const body = {
    model: settings.model,
    messages: [
      { role: 'system', content: TRANSLATION_SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ],
    // 结构化输出：让模型直接给 JSON，省掉解析 Markdown 代码块那一步
    response_format: { type: 'json_object' },
    // 翻译要的是稳定，不是创意
    temperature: 0.2,
    stream: false,
  };

  let lastError: TranslationErrorKind = 'network';
  let lastDetail: string | undefined;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${settings.apiKey}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        lastError = classify(response.status);
        // 响应体只截一小段，且**绝不**包含请求头（里面有 Key）
        lastDetail = (await response.text().catch(() => '')).slice(0, 200);
        if (!retryable(lastError)) return { ok: false, error: lastError, attempts: attempt, detail: lastDetail };
      } else {
        const payload = await response.json().catch(() => null);
        const content = extractContent(payload);
        if (!content) {
          return { ok: false, error: 'bad-response', attempts: attempt };
        }

        let decoded: unknown;
        try {
          decoded = JSON.parse(content);
        } catch {
          return { ok: false, error: 'bad-response', attempts: attempt };
        }

        const parsed = parse(decoded);
        if (parsed === null) return { ok: false, error: 'bad-response', attempts: attempt };

        return { ok: true, value: parsed, attempts: attempt };
      }
    } catch (error) {
      const aborted = error instanceof Error && error.name === 'AbortError';
      lastError = aborted ? 'timeout' : 'network';
      lastDetail = aborted ? '请求超时' : undefined;
      if (!retryable(lastError)) return { ok: false, error: lastError, attempts: attempt };
    } finally {
      clearTimeout(timer);
    }

    // 还有下一次尝试就退避等待
    if (attempt < MAX_ATTEMPTS) await sleep(BACKOFF_MS[attempt - 1] ?? 3_000);
  }

  return { ok: false, error: lastError, attempts: MAX_ATTEMPTS, detail: lastDetail };
}

/**
 * 调用 DeepSeek 翻译一批**商品字段**。
 *
 * 一次请求翻译「所有字段 × 所有目标语言」—— 需求要求尽量少的调用次数，
 * 而且批量翻译还能让模型在语言之间保持一致的语气。
 */
export async function translateWithDeepSeek(
  settings: TranslationSettings,
  request: TranslationRequest,
): Promise<TranslationResult> {
  const units: BatchUnit[] = Object.entries(request.source).map(([field, text]) => ({
    path: field,
    label: FIELD_LABELS_ZH[field as TranslatableField],
    text: text as string,
    format: detectFormat(text as string),
  }));

  const outcome = await callDeepSeek(settings, buildUnitPrompt(units, request.targets), (decoded) =>
    parseTranslationResponse(decoded, request),
  );
  if (!outcome.ok) return outcome;

  return {
    ok: true,
    values: outcome.value.values as Record<string, Partial<Record<TranslatableField, string>>>,
    attempts: outcome.attempts,
  };
}

// ---------------------------------------------------------------------------
// 通用批次（后台长任务用）
// ---------------------------------------------------------------------------

export interface UnitBatchResult {
  ok: true;
  /** 语言 → 路径 → 译文 */
  values: Record<string, Record<string, string>>;
  attempts: number;
}

/** 长任务里每一批的超时。刻意比手动翻译更短：批次本身小，久等只会拖长整条任务。 */
const BATCH_TIMEOUT_MS = 45_000;

/**
 * 翻译一批任意路径的字段。
 *
 * 与 `translateWithDeepSeek` 走同一个内核（同样的重试与错误归类），区别只在
 * 键名由适配器生成、而不是八个固定的商品字段。**不接受来自浏览器的键名** ——
 * 调用方是服务端的长任务引擎，键名全部来自 `adapters.ts` 生成的白名单路径。
 */
export async function translateUnitBatch(
  settings: TranslationSettings,
  units: readonly BatchUnit[],
  targets: readonly Locale[],
  options: { timeoutMs?: number } = {},
): Promise<UnitBatchResult | { ok: false; error: TranslationErrorKind; attempts: number; detail?: string }> {
  if (units.length === 0 || targets.length === 0) {
    return { ok: true, values: {}, attempts: 0 };
  }

  const keys = units.map((unit) => unit.path);
  const outcome = await callDeepSeek(
    settings,
    buildUnitPrompt(units, targets),
    (decoded) => parseUnitResponse(decoded, keys, targets),
    { timeoutMs: options.timeoutMs ?? BATCH_TIMEOUT_MS },
  );
  if (!outcome.ok) return outcome;

  return { ok: true, values: outcome.value, attempts: outcome.attempts };
}
