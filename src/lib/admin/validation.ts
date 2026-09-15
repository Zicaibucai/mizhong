import { z } from 'zod';

export const ADMIN_LOCALES = ['zh', 'en', 'vi'] as const;
export type AdminLocale = (typeof ADMIN_LOCALES)[number];

export const localeSchema = z.enum(['zh', 'en', 'vi']);
export const contactTypeSchema = z.enum(['EMAIL', 'WHATSAPP', 'PHONE', 'WECHAT', 'ADDRESS']);

export const loginSchema = z.object({
  email: z.string().trim().email('请输入有效的邮箱地址').max(200),
  password: z.string().min(8, '密码至少 8 位').max(200),
});

const optionalText = (max: number) => z.string().trim().max(max).default('');

// ---- 公司资料 ----
export const companyTranslationSchema = z.object({
  name: z.string().trim().min(1, '请填写公司名称').max(200),
  tagline: optionalText(300),
  about: optionalText(5000),
  positioning: optionalText(500),
  address: optionalText(500),
  businessHours: optionalText(200),
  seoTitle: optionalText(200),
  seoDescription: optionalText(400),
});

// ---- 联系方式 ----
export const contactTranslationSchema = z.object({
  label: optionalText(120),
  value: optionalText(300),
});

export const contactBaseSchema = z.object({
  id: z.string().trim().min(1).optional(),
  type: contactTypeSchema,
  value: optionalText(300),
  href: optionalText(500),
  sortOrder: z.coerce.number().int().min(0).max(9999).default(0),
  enabled: z.coerce.boolean().default(false),
});

// ---- 导航 ----
export const navTranslationSchema = z.object({
  label: optionalText(120),
});

export const navBaseSchema = z.object({
  id: z.string().trim().min(1).optional(),
  href: z
    .string()
    .trim()
    .min(1, '请填写链接地址')
    .max(500)
    .refine(
      (value) => value.startsWith('/') || value.startsWith('#') || /^https?:\/\/\S+$/.test(value),
      { message: '链接需为站内路径（/ 或 # 开头）或 http(s) 地址' },
    ),
  external: z.coerce.boolean().default(false),
  sortOrder: z.coerce.number().int().min(0).max(9999).default(0),
  enabled: z.coerce.boolean().default(false),
});

// ---- 页面 ----
export const pageTranslationSchema = z.object({
  title: z.string().trim().min(1, '请填写页面标题').max(200),
  seoTitle: optionalText(200),
  seoDescription: optionalText(400),
});

export const pageBaseSchema = z.object({
  id: z.string().trim().min(1),
  slug: z
    .string()
    .trim()
    .min(1, '请填写 slug')
    .max(120)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'slug 只能包含小写字母、数字与连字符'),
});

// ---- 页面区块 ----
export const blockTranslationSchema = z.object({
  title: optionalText(300),
  subtitle: optionalText(1000),
  body: optionalText(3000),
  ctaLabel: optionalText(120),
  ctaHref: optionalText(500),
});

export const blockBaseSchema = z.object({
  id: z.string().trim().min(1),
  enabled: z.coerce.boolean().default(false),
});

export const idSchema = z.object({
  id: z.string().trim().min(1),
});

// ---------------------------------------------------------------------------
// 解析辅助（服务端使用）
// ---------------------------------------------------------------------------

type AnyZodObject = z.ZodObject<z.ZodRawShape>;

export type ParseResult<T> = { ok: true; data: T } | { ok: false; message: string };

/** 解析表单中的非多语言字段 */
export function parseForm<S extends AnyZodObject>(schema: S, formData: FormData): ParseResult<z.infer<S>> {
  const raw: Record<string, unknown> = {};
  for (const key of Object.keys(schema.shape)) {
    raw[key] = formData.get(key);
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? '内容不合法' };
  }
  return { ok: true, data: parsed.data };
}

/** 解析形如 `zh_name` / `en_name` 的多语言字段 */
export function parseLocaleFields<S extends AnyZodObject>(
  schema: S,
  locale: AdminLocale,
  formData: FormData,
): ParseResult<z.infer<S>> {
  const raw: Record<string, unknown> = {};
  for (const key of Object.keys(schema.shape)) {
    raw[key] = formData.get(`${locale}_${key}`);
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const localeLabel = { zh: '中文', en: 'English', vi: 'Tiếng Việt' }[locale];
    return {
      ok: false,
      message: `${localeLabel}：${parsed.error.issues[0]?.message ?? '内容不合法'}`,
    };
  }
  return { ok: true, data: parsed.data };
}
