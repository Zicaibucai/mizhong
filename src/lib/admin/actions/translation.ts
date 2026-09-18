'use server';

import { z } from 'zod';
import { getPrisma } from '@/lib/db';
import { writeAudit } from '@/lib/audit';
import { getDbUnavailableState, requireAdminOrError } from '@/lib/admin/guard';
import { getAdminMessagesForRequest, type AdminMessages } from '@/lib/admin/i18n';
import { translateWithDeepSeek, type TranslationErrorKind } from '@/lib/translation/deepseek';
import {
  parseTranslationRequest,
  translatableFieldSchema,
  type TranslatableField,
} from '@/lib/translation/fields';
import { slugify, uniqueSlug } from '@/lib/slug';
import { loadTranslationSettings, saveTranslationSettings } from '@/lib/translation/settings';
import type { FormState } from '@/lib/admin/action-state';

/**
 * 翻译相关的 Server Actions。
 *
 * **前端不直接请求 DeepSeek**：浏览器把中文原文与目标语言交给这里的 action，
 * 由服务端拿 API Key 发起请求。API Key 从不出现在任何返回给浏览器的数据里。
 */

// ---------------------------------------------------------------------------
// 一键翻译
// ---------------------------------------------------------------------------

export interface TranslateFieldInput {
  /** 字段名 → 该字段在**表单里当前**的中文内容（不是数据库里的旧值） */
  source: Record<string, string>;
  /** 目标语言 */
  targets: string[];
  /**
   * 目标语言已有的内容，用于判断「这个位置是不是已经有人工填写」。
   * 同样取自表单，而不是数据库 —— 用户可能刚手工改过还没保存。
   */
  existing: Record<string, Record<string, string>>;
  /** 是否覆盖已有译文。默认 false。 */
  overwrite?: boolean;
}

export type TranslateActionResult =
  | {
      status: 'success';
      /** 可以写入表单的译文：`[locale][field]` */
      applied: Record<string, Partial<Record<TranslatableField, string>>>;
      /** 因为已有内容而被跳过的位置 */
      skipped: { locale: string; field: TranslatableField }[];
      /** 没有翻译成功的语言及原因 */
      failures: { locale: string; reason: string }[];
      /** 实际翻译了多少个字段 */
      fieldCount: number;
      attempts: number;
    }
  | { status: 'error'; reason: TranslateErrorReason; message: string };

export type TranslateErrorReason =
  | 'invalid'
  | 'empty-source'
  | 'too-large'
  | 'not-configured'
  | TranslationErrorKind;

/** 把底层错误翻译成用户能照着做的一句话 */
function describeError(
  reason: TranslateErrorReason,
  t: AdminMessages,
): string {
  switch (reason) {
    case 'empty-source':
      return t.translation.emptySource;
    case 'too-large':
      return t.translation.tooLarge;
    case 'not-configured':
      return t.translation.notConfigured;
    case 'auth':
      return t.translation.errorAuth;
    case 'rate-limit':
      return t.translation.errorRateLimit;
    case 'timeout':
      return t.translation.errorTimeout;
    case 'server':
      return t.translation.errorServer;
    case 'network':
      return t.translation.errorNetwork;
    case 'invalid':
      return t.validation.invalidInput;
    default:
      return t.translation.errorBadResponse;
  }
}

export async function translateProductContentAction(
  input: TranslateFieldInput,
): Promise<TranslateActionResult> {
  const { t } = await getAdminMessagesForRequest();

  const guard = await requireAdminOrError(t);
  if ('error' in guard) {
    return { status: 'error', reason: 'invalid', message: guard.error.message ?? t.validation.invalidInput };
  }
  const { user } = guard;

  // 信任边界：字段白名单、语言白名单、请求体积全部在这里收敛
  const parsed = parseTranslationRequest({ source: input.source, targets: input.targets });
  if (!parsed.ok) {
    const reason: TranslateErrorReason =
      parsed.reason === 'empty' ? 'empty-source' : parsed.reason === 'too-large' ? 'too-large' : 'invalid';
    return { status: 'error', reason, message: describeError(reason, t) };
  }

  const db = getPrisma();
  if (!db) return { status: 'error', reason: 'invalid', message: getDbUnavailableState(t).message ?? '' };

  const settings = await loadTranslationSettings(db);
  if (!settings.apiKey) {
    return {
      status: 'error',
      reason: 'not-configured',
      message: describeError('not-configured', t),
    };
  }

  const result = await translateWithDeepSeek(settings, parsed.data);

  if (!result.ok) {
    // 日志里只有错误类别与截断后的响应片段，绝不包含 API Key
    console.error('[admin] deepseek translation failed:', result.error, result.attempts);
    return {
      status: 'error',
      reason: result.error,
      message: describeError(result.error, t),
    };
  }

  // 合并规则见 mergeTranslations 的注释；这里只需要它来算「哪些被跳过」
  const existing: Record<string, Partial<Record<TranslatableField, string>>> = {};
  for (const [locale, fields] of Object.entries(input.existing ?? {})) {
    const clean: Partial<Record<TranslatableField, string>> = {};
    for (const [field, value] of Object.entries(fields)) {
      const parsedField = translatableFieldSchema.safeParse(field);
      if (parsedField.success && typeof value === 'string') clean[parsedField.data] = value;
    }
    existing[locale] = clean;
  }

  const skipped: { locale: string; field: TranslatableField }[] = [];
  const applied: Record<string, Partial<Record<TranslatableField, string>>> = {};
  const overwrite = input.overwrite === true;

  for (const [locale, fields] of Object.entries(result.values)) {
    for (const [field, value] of Object.entries(fields) as [TranslatableField, string][]) {
      // 原文为空的位置不接受译文（模型有时会自行补全）
      if (!parsed.data.source[field]) continue;
      const current = existing[locale]?.[field]?.trim() ?? '';
      if (current && !overwrite) {
        skipped.push({ locale, field });
        continue;
      }
      applied[locale] = { ...(applied[locale] ?? {}), [field]: value };
    }
  }

  // 哪些语言一条都没翻出来 —— 逐语言报告，成功的那部分照常保留
  const failures = parsed.data.targets
    .filter((locale) => !applied[locale])
    .map((locale) => ({ locale, reason: t.translation.errorBadResponse }));

  await writeAudit({
    userId: user.id,
    actorEmail: user.email,
    action: 'UPDATE',
    targetType: 'Product',
    targetId: null,
    summary: t.translation.auditSummary,
    detail: {
      targets: parsed.data.targets,
      fields: Object.keys(parsed.data.source),
      model: settings.model,
      attempts: result.attempts,
    },
  });

  return {
    status: 'success',
    applied,
    skipped,
    failures,
    fieldCount: Object.keys(parsed.data.source).length,
    attempts: result.attempts,
  };
}

// ---------------------------------------------------------------------------
// 后台保存 DeepSeek 配置
// ---------------------------------------------------------------------------

const settingsSchema = z.object({
  // 留空表示「不改动现有 Key」，而不是把 Key 清空
  apiKey: z.string().trim().max(400).default(''),
  baseUrl: z
    .string()
    .trim()
    .max(300)
    .refine((value) => value === '' || /^https?:\/\//.test(value), { message: 'invalid' }),
  model: z.string().trim().max(120),
});

export async function saveTranslationSettingsAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { t } = await getAdminMessagesForRequest();

  const guard = await requireAdminOrError(t);
  if ('error' in guard) return guard.error;
  const { user } = guard;

  const parsed = settingsSchema.safeParse({
    apiKey: formData.get('apiKey') ?? '',
    baseUrl: formData.get('baseUrl') ?? '',
    model: formData.get('model') ?? '',
  });
  if (!parsed.success) return { status: 'error', message: t.validation.invalidInput };

  const db = getPrisma();
  if (!db) return getDbUnavailableState(t);

  try {
    await saveTranslationSettings(db, {
      apiKey: parsed.data.apiKey,
      baseUrl: parsed.data.baseUrl || 'https://api.deepseek.com/v1',
      model: parsed.data.model || 'deepseek-chat',
    });

    await writeAudit({
      userId: user.id,
      actorEmail: user.email,
      action: 'UPDATE',
      targetType: 'SiteSetting',
      targetId: 'translation.deepseek',
      // 只记「换没换 Key」，绝不记 Key 本身
      summary: t.translation.settingsSaved,
      detail: { keyChanged: parsed.data.apiKey.length > 0, model: parsed.data.model },
    });
  } catch (error) {
    console.error('[admin] save translation settings failed:', error);
    return { status: 'error', message: t.actions.saveFailed };
  }

  return { status: 'success', message: t.translation.settingsSaved };
}

// 注意：`'use server'` 模块里的导出**必须全是 async 函数**，
// 所以「目标语言清单」这类常量不能放在这里 —— 它在 lib/translation/fields.ts，
// 界面直接引用那个常量即可。

// ---------------------------------------------------------------------------
// 网址后缀（slug）
// ---------------------------------------------------------------------------

/**
 * 根据英文名称生成一个可用的 slug。
 *
 * 需求里的三条规则都在这里落地：
 *   1. **优先用英文名称**生成；
 *   2. 英文名为空但中文名不为空时，先让 DeepSeek 给出一个英文名，再生成 slug；
 *   3. 检查是否重复，重复就按项目现有的规则追加序号（`_2`、`_3`…）。
 *
 * 这个 action 只**返回** slug，不写数据库 —— 后端写入时会重新校验格式与唯一性
 * （见 saveProductVisualAction 与 setProductPublishedAction），前端校验只是提前提示。
 */
export async function generateSlugAction(input: {
  productId: string;
  englishName: string;
  chineseName: string;
}): Promise<
  | { status: 'success'; slug: string; generatedName: string | null }
  | { status: 'error'; message: string }
> {
  const { t } = await getAdminMessagesForRequest();

  const guard = await requireAdminOrError(t);
  if ('error' in guard) return { status: 'error', message: guard.error.message ?? t.validation.invalidInput };

  const englishName = typeof input.englishName === 'string' ? input.englishName.trim().slice(0, 200) : '';
  const chineseName = typeof input.chineseName === 'string' ? input.chineseName.trim().slice(0, 200) : '';
  if (!englishName && !chineseName) {
    return { status: 'error', message: t.slug.nothingToUse };
  }

  const db = getPrisma();
  if (!db) return { status: 'error', message: getDbUnavailableState(t).message ?? '' };

  let sourceName = englishName;
  let generatedName: string | null = null;

  // 英文名为空 → 请模型先给一个英文名
  if (!sourceName) {
    const settings = await loadTranslationSettings(db);
    if (!settings.apiKey) return { status: 'error', message: t.slug.needsEnglishName };

    const translation = await translateWithDeepSeek(settings, {
      source: { name: chineseName },
      targets: ['en'],
    });
    if (!translation.ok || !translation.values.en?.name) {
      return { status: 'error', message: t.slug.englishNameFailed };
    }
    sourceName = translation.values.en.name;
    generatedName = sourceName;
  }

  const base = slugify(sourceName);
  if (!base) return { status: 'error', message: t.slug.nothingToUse };

  // 唯一性：排除自己（改自己的 slug 时不该和自己冲突）
  const slug = await uniqueSlug(base, async (candidate) => {
    const owner = await db.product.findFirst({
      where: { slug: candidate, id: { not: input.productId } },
      select: { id: true },
    });
    return Boolean(owner);
  });

  return { status: 'success', slug, generatedName };
}
