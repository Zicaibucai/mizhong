import type { PrismaClient } from '@prisma/client';
import type { Locale } from '@/lib/i18n/config';
import { locales } from '@/lib/i18n/config';
import { getAdapter } from '@/lib/translation/adapters';
import { planSync } from '@/lib/translation/state';
import type { JobProgress } from '@/lib/translation/jobs';
import type { AdminMessages } from '@/lib/admin/i18n';

/**
 * 应急发布的判定与文案。
 *
 * 「应急发布中文，其他语言稍后同步」是 DeepSeek 故障时的兜底，**不是**
 * 绕过翻译的常规出口。因此它能出现的条件收得很紧：只有翻译服务本身
 * **暂时**不可用才算数 —— 数据、配置、权限、内容的问题一律挡在门外。
 *
 * 这条边界如果放松，应急发布就会变成默认路径：管理员遇到任何阻碍都会点它，
 * 几个月后线上就会有一堆永远补不齐的语言，而且没人记得为什么。
 */

/**
 * 允许应急发布的失败类型 —— 全部是「等一会儿可能就好了」的那一类。
 *
 * 与 `TranslationErrorKind` 的对应关系：
 *   timeout    → 请求超时
 *   network    → 网络不可达
 *   rate-limit → 429
 *   server     → DeepSeek 5xx（含「服务暂时不可用」）
 *
 * 刻意**不包括**：
 *   not-configured → 没配 Key。修它要十秒，放进来只会让应急成为习惯
 *   auth           → Key 被拒。同上，是配置问题不是服务故障
 *   bad-response   → 返回结构不对。属于「数据结构错误」，按需求明确排除
 */
export const TRANSIENT_FAILURES = ['timeout', 'network', 'rate-limit', 'server'] as const;
export type TransientFailure = (typeof TRANSIENT_FAILURES)[number];

export function isTransientFailure(kind: string | null | undefined): kind is TransientFailure {
  return typeof kind === 'string' && (TRANSIENT_FAILURES as readonly string[]).includes(kind);
}

export interface EmergencyEligibility {
  eligible: boolean;
  /** 判定为可应急时的失败类型，用于发布记录与界面提示 */
  failureKind: TransientFailure | null;
  /**
   * 不可应急时的原因分类。
   * `content` = 内容/校验问题，`config` = 配置问题，`service` = 服务故障（可应急）
   */
  reason: 'service' | 'config' | 'content' | 'none-needed' | 'unknown';
}

/**
 * 判断一次失败的发布同步是否够格走应急发布。
 *
 * 规则是「**所有**失败项都必须是暂时性故障」。只要掺进一个结构错误或配置错误，
 * 就整体不可应急 —— 因为那说明问题不在服务可用性上，应急发布只会把问题
 * 掩盖成一个看起来发布成功的版本。
 */
export function classifyPublishFailure(progress: JobProgress | null | undefined): EmergencyEligibility {
  if (!progress) return { eligible: false, failureKind: null, reason: 'unknown' };

  // 内容是空的时候本来就不需要应急 —— 同步没做完不算「服务故障」
  if (progress.pendingItems > 0) return { eligible: false, failureKind: null, reason: 'none-needed' };

  // 中文在同步过程中被改过，或收尾时仍有字段待同步：这是内容一致性问题，
  // 再点一次发布即可，不是服务故障
  if (progress.lastError === 'source-changed' || progress.lastError === 'still-pending') {
    return { eligible: false, failureKind: null, reason: 'content' };
  }

  if (progress.failedItems === 0) return { eligible: false, failureKind: null, reason: 'none-needed' };

  const kinds = progress.failures.map((item) => item.error ?? '');
  if (kinds.length === 0) return { eligible: false, failureKind: null, reason: 'unknown' };

  const transient = kinds.filter(isTransientFailure);
  if (transient.length !== kinds.length) {
    // 混进了非暂时性失败。区分开是配置还是内容，界面据此给出不同的下一步。
    const rest = kinds.filter((kind) => !isTransientFailure(kind));
    const config = rest.every((kind) => kind === 'not-configured' || kind === 'auth');
    return { eligible: false, failureKind: null, reason: config ? 'config' : 'content' };
  }

  // 取出现次数最多的那一种，作为这次故障的代表
  const counts = new Map<string, number>();
  for (const kind of transient) counts.set(kind, (counts.get(kind) ?? 0) + 1);
  const [top] = [...counts.entries()].sort((a, b) => b[1] - a[1]);

  return { eligible: true, failureKind: top[0] as TransientFailure, reason: 'service' };
}

/**
 * 应急发布前再确认一次「确实有语言没同步好」。
 *
 * 客户端说「可以应急」不算数 —— 它可能是一个改过的请求。所以服务端自己再算一遍：
 * 真的有待同步的语言才放行，全同步好了就没必要应急（正常发布即可）。
 */
export async function confirmEmergencyNeed(
  db: PrismaClient,
  entityType: string,
  entityId: string,
): Promise<{ needed: boolean; plan: Awaited<ReturnType<typeof planSync>> }> {
  const plan = await planSync(db, entityType, entityId);
  if (!plan) return { needed: false, plan: null };
  const needed = plan.locales.some((item) => item.state !== 'synced' && item.state !== 'empty');
  return { needed, plan };
}

export interface LocaleCoverage {
  /** 已有自己的译文、这次只能沿用上一版的语言 */
  staleLocales: Locale[];
  /** 完全没有译文、应急发布后仍然没有的语言 */
  missingLocales: Locale[];
}

/**
 * 按「有没有自己的译文」把语言分成两类，写进发布记录。
 *
 * 需求要求记录「哪些语言仍为旧版本或缺失」—— 这两类对使用者的含义完全不同：
 * 前者页面上还是能看到的（只是旧），后者页面上根本没有该语言的内容。
 */
export async function localeCoverage(
  db: PrismaClient,
  entityType: string,
  entityId: string,
): Promise<LocaleCoverage> {
  const adapter = getAdapter(entityType);
  const targets = locales.filter((locale) => locale !== 'zh');
  if (!adapter) return { staleLocales: [], missingLocales: [] };

  const current = await adapter.readTargets(db, entityId, targets);
  const staleLocales: Locale[] = [];
  const missingLocales: Locale[] = [];

  for (const locale of targets) {
    const values = current[locale] ?? {};
    const hasAny = Object.values(values).some((value) => (value ?? '').trim().length > 0);
    if (hasAny) staleLocales.push(locale);
    else missingLocales.push(locale);
  }

  return { staleLocales, missingLocales };
}

/**
 * 应急发布写进审计日志的明细。
 *
 * 抽成纯函数是为了能被测试**直接断言**：「审计里没有 Key、没有原文、没有译文」
 * 这条要求如果只靠读代码来相信，早晚会有人顺手加一个 `detail.draft = draft`。
 *
 * 允许出现的只有元数据：发布记录 id、性质、原因、失败类型、中文版本号、
 * 以及哪些语言仍停在旧版 / 仍然缺失。管理员填写的原因会完整记录 —— 那是人写的，
 * 不是从内容里复制出来的。
 */
export interface EmergencyAuditDetail {
  /** Prisma 的 JSON 字段要求索引签名；取值只可能是这三种标量或它们的数组 */
  [key: string]: string | string[] | number | null;
  releaseId: string;
  kind: string;
  reason: string;
  failureKind: string | null;
  sourceRevision: number;
  staleLocales: string[];
  missingLocales: string[];
}

export function buildEmergencyAuditDetail(input: {
  releaseId: string;
  reason: string;
  failureKind: string | null;
  revision: number;
  staleLocales: readonly string[];
  missingLocales: readonly string[];
}): EmergencyAuditDetail {
  return {
    releaseId: input.releaseId,
    kind: 'EMERGENCY',
    reason: input.reason,
    failureKind: input.failureKind,
    sourceRevision: input.revision,
    staleLocales: [...input.staleLocales],
    missingLocales: [...input.missingLocales],
  };
}

/** 把失败类型翻成一句人话，供确认框与后台提示使用 */
export function describeFailureKind(kind: string | null | undefined, t: AdminMessages): string {
  switch (kind) {
    case 'timeout':
      return t.emergency.failureTimeout;
    case 'network':
      return t.emergency.failureNetwork;
    case 'rate-limit':
      return t.emergency.failureRateLimit;
    case 'server':
      return t.emergency.failureServer;
    default:
      return t.emergency.failureUnknown;
  }
}

/** 不可应急时，告诉管理员该去做什么 */
export function describeBlockedReason(reason: EmergencyEligibility['reason'], t: AdminMessages): string {
  switch (reason) {
    case 'config':
      return t.emergency.blockedConfig;
    case 'content':
      return t.emergency.blockedContent;
    case 'none-needed':
      return t.emergency.blockedNoneNeeded;
    default:
      return t.emergency.blockedUnknown;
  }
}
