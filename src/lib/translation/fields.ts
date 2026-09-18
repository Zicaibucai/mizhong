import { z } from 'zod';
import { ADMIN_LOCALES } from '@/lib/admin/validation';
import { localeEnglishNames, locales, type Locale } from '@/lib/i18n/config';

/**
 * 可翻译字段的**白名单**。
 *
 * 后端只接受这里列出的字段名，前端传别的名字一律丢弃 —— 翻译接口不接受任意字段，
 * 否则它就变成了一个「拿服务器上的 API Key 去打任意提示词」的入口。
 *
 * 字段名与 `ProductTranslationValues` 的键一一对应，新增语言字段时这里同步加一条即可。
 */
export const TRANSLATABLE_FIELDS = [
  'name',
  'shortDescription',
  'description',
  'sizeSummary',
  'spec',
  'application',
  'seoTitle',
  'seoDescription',
] as const;

export type TranslatableField = (typeof TRANSLATABLE_FIELDS)[number];

/** 字段的中文说明，用于提示词与「哪些字段被跳过了」的提示 */
export const FIELD_LABELS_ZH: Record<TranslatableField, string> = {
  name: '商品名称',
  shortDescription: '一句话介绍',
  description: '完整介绍',
  sizeSummary: '尺寸摘要',
  spec: '规格说明',
  application: '应用场景',
  seoTitle: 'SEO 标题',
  seoDescription: 'SEO 描述',
};

export const translatableFieldSchema = z.enum(TRANSLATABLE_FIELDS);

/**
 * 目标语言白名单：不能翻成「系统不认识的语言」。
 * 中文本身也是合法的目标语言（用于中→其它语言之外的场景，例如从英文回译），
 * 但界面上只会把它作为源语言，见 translateProductContentAction 的说明。
 */
export const targetLocaleSchema = z.enum(locales);

/** 源语言：目前只支持以中文为源（需求即为「把中文内容翻译成其它语言」） */
export const SOURCE_LOCALE: Locale = 'zh';

/**
 * 默认的目标语言：除中文以外的全部语言。
 * 从统一的语言清单派生，加语言后自动包含新语言。
 */
export const DEFAULT_TARGET_LOCALES: Locale[] = locales.filter((locale) => locale !== SOURCE_LOCALE);

// ---------------------------------------------------------------------------
// 请求体的大小限制
// ---------------------------------------------------------------------------

/** 单个字段的最大字符数（与后台表单的 Zod 上限一致，取最大的一档） */
const MAX_FIELD_LENGTH = 10_000;

/** 一次请求里所有字段加起来的最大字符数 —— 防止有人把整本书塞进来 */
export const MAX_TOTAL_SOURCE_LENGTH = 40_000;

/** 一次请求最多翻译多少种语言 */
export const MAX_TARGET_LOCALES = locales.length;

/** 中文原文 + 已有译文，按目标语言组织 */
export interface TranslationRequest {
  /** 字段名 → 中文原文（只包含非空字段） */
  source: Partial<Record<TranslatableField, string>>;
  /** 目标语言 */
  targets: Locale[];
}

const requestSchema = z.object({
  source: z.record(translatableFieldSchema, z.string().max(MAX_FIELD_LENGTH)),
  targets: z.array(targetLocaleSchema).min(1).max(MAX_TARGET_LOCALES),
});

export type ParseResult =
  | { ok: true; data: TranslationRequest }
  | { ok: false; reason: 'invalid' | 'too-large' | 'empty' };

/**
 * 校验并裁剪前端传来的翻译请求。
 *
 * 这里是**信任边界**：字段名、语言代码、请求体大小都在这里收敛，
 * 之后的所有环节都只处理已经校验过的数据。
 */
export function parseTranslationRequest(input: unknown): ParseResult {
  const parsed = requestSchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: 'invalid' };

  // 去掉纯空白字段：空字段不该被送去翻译
  const source: Partial<Record<TranslatableField, string>> = {};
  let total = 0;
  for (const [field, value] of Object.entries(parsed.data.source)) {
    const text = value.trim();
    if (!text) continue;
    total += text.length;
    source[field as TranslatableField] = text;
  }

  if (total > MAX_TOTAL_SOURCE_LENGTH) return { ok: false, reason: 'too-large' };
  if (Object.keys(source).length === 0) return { ok: false, reason: 'empty' };

  // 去重，并且源语言不作为目标语言
  const targets = [...new Set(parsed.data.targets)].filter(
    (locale): locale is Locale => locale !== SOURCE_LOCALE && ADMIN_LOCALES.includes(locale),
  );
  if (targets.length === 0) return { ok: false, reason: 'empty' };

  return { ok: true, data: { source, targets } };
}

// ---------------------------------------------------------------------------
// 提示词
// ---------------------------------------------------------------------------

/**
 * 系统提示词。
 *
 * 逐字采用需求里指定的那段话 —— 它已经把最重要的几条约束（不得增加原文没有的信息、
 * 保持品牌名/型号/数字/单位/HTML/Markdown/变量占位符、只输出 JSON）写全了。
 * **前端不能传提示词进来**，这个常量只存在于服务端。
 */
export const TRANSLATION_SYSTEM_PROMPT =
  '你是一名专业的电商/企业网站本地化翻译。请将中文内容翻译为指定语言。译文要自然、专业，符合目标国家用户的表达习惯。不得添加原文不存在的信息。品牌名、产品型号、数字、单位、HTML 标签、Markdown 格式和变量占位符必须保持正确。请严格按照指定 JSON 结构返回，不要输出解释或 Markdown。';

/**
 * 构造用户消息。
 *
 * 刻意把「字段名」原样留在 JSON 里：模型只要照着键回填，就不存在
 * 「把名称填进描述里」这类错位 —— 需求里要求「不能把内容填错位置」，
 * 靠结构而不是靠模型自觉来保证。
 */
export function buildTranslationUserPrompt(request: TranslationRequest): string {
  const languageList = request.targets
    .map((locale) => `- ${locale}: ${localeEnglishNames[locale]}`)
    .join('\n');

  const fieldList = Object.keys(request.source)
    .map((field) => `- ${field}: ${FIELD_LABELS_ZH[field as TranslatableField]}`)
    .join('\n');

  return [
    '请把下面 JSON 中 source 里的每个中文字段，翻译成这些语言：',
    languageList,
    '',
    '需要翻译的字段：',
    fieldList,
    '',
    '严格按这个结构返回（键名原样保留，不要增删）：',
    '{',
    '  "translations": {',
    `    ${request.targets.map((locale) => `"${locale}": { ${Object.keys(request.source).map((f) => `"${f}": "译文"`).join(', ')} }`).join(',\n    ')}`,
    '  }',
    '}',
    '',
    '要求：',
    '1. 每个字段的译文必须放回**同名字段**，不要错位。',
    '2. 某条原文为空时不要凭空补内容。',
    '3. 数字、单位、型号、品牌名保持原样（例如 "25 mm"、"A-2026"、"3M" 不要翻译）。',
    '4. 原文里的 HTML 标签、Markdown 标记、{占位符} 原样保留。',
    '5. 只输出 JSON，不要输出任何解释或 Markdown 代码块。',
    '',
    '原文：',
    JSON.stringify({ source: request.source }, null, 2),
  ].join('\n');
}

// ---------------------------------------------------------------------------
// 返回结果的校验
// ---------------------------------------------------------------------------

/**
 * 校验模型的返回。
 *
 * 只接受「目标语言都在、字段名都在」的结果；多出来的键直接忽略，
 * 缺的键按「该字段翻译失败」处理，不编造内容。
 */
export function parseTranslationResponse(
  raw: unknown,
  request: TranslationRequest,
): { values: Record<string, Partial<Record<TranslatableField, string>>> } | null {
  if (!raw || typeof raw !== 'object') return null;
  const container = (raw as Record<string, unknown>).translations;
  if (!container || typeof container !== 'object') return null;

  const values: Record<string, Partial<Record<TranslatableField, string>>> = {};

  for (const locale of request.targets) {
    const entry = (container as Record<string, unknown>)[locale];
    if (!entry || typeof entry !== 'object') continue;

    const filled: Partial<Record<TranslatableField, string>> = {};
    for (const field of Object.keys(request.source) as TranslatableField[]) {
      const value = (entry as Record<string, unknown>)[field];
      if (typeof value !== 'string') continue;
      const text = value.trim();
      // 模型返回空串＝这条没翻出来，宁可留空让用户自己填，也不填个占位符进去
      if (text) filled[field] = text;
    }
    if (Object.keys(filled).length > 0) values[locale] = filled;
  }

  return Object.keys(values).length > 0 ? { values } : null;
}

// ---------------------------------------------------------------------------
// 把译文合并进表单
// ---------------------------------------------------------------------------

export interface MergeOutcome {
  /** 真正要写进表单的值：`[locale][field] = 译文` */
  applied: Record<string, Partial<Record<TranslatableField, string>>>;
  /** 因为有内容而被跳过的位置，用于提示「哪些字段没有覆盖」 */
  skipped: { locale: string; field: TranslatableField }[];
  /** 译文里出现、但原文为空的字段 —— 模型多给了内容，一律丢弃 */
  unexpected: { locale: string; field: TranslatableField }[];
}

/**
 * 决定哪些译文可以写进表单。
 *
 * 三条规则，全部是纯函数，便于单测：
 *   1. **原文为空的字段不接受译文** —— 需求要求「中文为空时目标语言也保持为空」，
 *      所以即使模型硬塞了内容，这里也会把它归到 `unexpected` 并丢弃；
 *   2. 目标字段已有内容时默认**跳过**（不覆盖用户手工填写的翻译），
 *      只有 `overwrite` 为真才允许覆盖；
 *   3. 目标字段为空则直接写入。
 *
 * 注意这里比较的是**表单里的当前值**（由调用方从 DOM 采集后传入），
 * 不是数据库里的旧值 —— 需求明确要求「翻译前先读取前端表单中的最新内容」。
 */
export function mergeTranslations(
  incoming: Record<string, Partial<Record<TranslatableField, string>>>,
  current: Record<string, Partial<Record<TranslatableField, string>>>,
  source: Partial<Record<TranslatableField, string>>,
  options: { overwrite: boolean },
): MergeOutcome {
  const applied: MergeOutcome['applied'] = {};
  const skipped: MergeOutcome['skipped'] = [];
  const unexpected: MergeOutcome['unexpected'] = [];

  for (const [locale, fields] of Object.entries(incoming)) {
    for (const [field, value] of Object.entries(fields) as [TranslatableField, string][]) {
      if (!value) continue;

      if (!source[field]) {
        unexpected.push({ locale, field });
        continue;
      }

      const existing = current[locale]?.[field]?.trim() ?? '';
      if (existing && !options.overwrite) {
        skipped.push({ locale, field });
        continue;
      }

      applied[locale] = { ...(applied[locale] ?? {}), [field]: value };
    }
  }

  return { applied, skipped, unexpected };
}
