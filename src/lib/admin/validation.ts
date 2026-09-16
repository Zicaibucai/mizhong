import { z } from 'zod';
import type { AdminMessages } from './i18n';
import { getContentLocaleLabel } from './labels';

export const ADMIN_LOCALES = ['zh', 'en', 'vi'] as const;
export type AdminLocale = (typeof ADMIN_LOCALES)[number];

export const localeSchema = z.enum(['zh', 'en', 'vi']);
export const contactTypeSchema = z.enum(['EMAIL', 'WHATSAPP', 'PHONE', 'WECHAT', 'ADDRESS']);

const optionalText = (max: number) => z.string().trim().max(max).default('');

// ---------------------------------------------------------------------------
// Schemas
//
// Validation messages are user-visible, so every schema is built from the admin
// messages of the current request. Build them with the factories below inside
// the server action / page that has a message object at hand.
// ---------------------------------------------------------------------------

export function makeLoginSchema(t: AdminMessages) {
  return z.object({
    email: z.string().trim().email(t.validation.emailInvalid).max(200),
    password: z.string().min(8, t.validation.passwordMin).max(200),
  });
}

// ---- Company profile ----
export function makeCompanyTranslationSchema(t: AdminMessages) {
  return z.object({
    name: z.string().trim().min(1, t.validation.companyNameRequired).max(200),
    tagline: optionalText(300),
    about: optionalText(5000),
    positioning: optionalText(500),
    address: optionalText(500),
    businessHours: optionalText(200),
    seoTitle: optionalText(200),
    seoDescription: optionalText(400),
  });
}
export type CompanyTranslationInput = z.infer<ReturnType<typeof makeCompanyTranslationSchema>>;

// ---- Contact methods ----
export function makeContactTranslationSchema() {
  return z.object({
    label: optionalText(120),
    value: optionalText(300),
  });
}
export type ContactTranslationInput = z.infer<ReturnType<typeof makeContactTranslationSchema>>;

export function makeContactBaseSchema(t: AdminMessages) {
  return z.object({
    id: z.string().trim().min(1, t.validation.invalidInput).optional(),
    type: contactTypeSchema,
    value: optionalText(300),
    href: optionalText(500),
    sortOrder: z.coerce.number().int().min(0).max(9999).default(0),
    enabled: z.coerce.boolean().default(false),
  });
}
export type ContactBaseInput = z.infer<ReturnType<typeof makeContactBaseSchema>>;

// ---- Navigation ----
export function makeNavTranslationSchema() {
  return z.object({
    label: optionalText(120),
  });
}
export type NavTranslationInput = z.infer<ReturnType<typeof makeNavTranslationSchema>>;

export function makeNavBaseSchema(t: AdminMessages) {
  return z.object({
    id: z.string().trim().min(1, t.validation.invalidInput).optional(),
    href: z
      .string()
      .trim()
      .min(1, t.validation.linkRequired)
      .max(500)
      .refine(
        (value) => value.startsWith('/') || value.startsWith('#') || /^https?:\/\/\S+$/.test(value),
        { message: t.validation.linkFormat },
      ),
    external: z.coerce.boolean().default(false),
    sortOrder: z.coerce.number().int().min(0).max(9999).default(0),
    enabled: z.coerce.boolean().default(false),
  });
}
export type NavBaseInput = z.infer<ReturnType<typeof makeNavBaseSchema>>;

// ---- Pages ----
export function makePageTranslationSchema(t: AdminMessages) {
  return z.object({
    title: z.string().trim().min(1, t.validation.pageTitleRequired).max(200),
    seoTitle: optionalText(200),
    seoDescription: optionalText(400),
  });
}
export type PageTranslationInput = z.infer<ReturnType<typeof makePageTranslationSchema>>;

export function makePageBaseSchema(t: AdminMessages) {
  return z.object({
    id: z.string().trim().min(1, t.validation.invalidInput),
    slug: z
      .string()
      .trim()
      .min(1, t.validation.slugRequired)
      .max(120)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, t.validation.slugFormat),
  });
}
export type PageBaseInput = z.infer<ReturnType<typeof makePageBaseSchema>>;

// ---- Page blocks ----
export function makeBlockTranslationSchema() {
  return z.object({
    title: optionalText(300),
    subtitle: optionalText(1000),
    body: optionalText(3000),
    ctaLabel: optionalText(120),
    ctaHref: optionalText(500),
  });
}
export type BlockTranslationInput = z.infer<ReturnType<typeof makeBlockTranslationSchema>>;

export function makeBlockBaseSchema(t: AdminMessages) {
  return z.object({
    id: z.string().trim().min(1, t.validation.invalidInput),
    enabled: z.coerce.boolean().default(false),
  });
}
export type BlockBaseInput = z.infer<ReturnType<typeof makeBlockBaseSchema>>;

export function makeIdSchema(t: AdminMessages) {
  return z.object({
    id: z.string().trim().min(1, t.validation.invalidInput),
  });
}
export type IdInput = z.infer<ReturnType<typeof makeIdSchema>>;

// ---------------------------------------------------------------------------
// Parsing helpers (server side)
// ---------------------------------------------------------------------------

type AnyZodObject = z.ZodObject<z.ZodRawShape>;

export type ParseResult<T> = { ok: true; data: T } | { ok: false; message: string };

/** Parse the non-localized fields of a form */
export function parseForm<S extends AnyZodObject>(
  schema: S,
  formData: FormData,
  t: AdminMessages,
): ParseResult<z.infer<S>> {
  const raw: Record<string, unknown> = {};
  for (const key of Object.keys(schema.shape)) {
    // 表单未提交的字段 get() 返回 null，而 Zod 的 .optional() 只接受 undefined，
    // 因此这里必须把 null 归一化为 undefined，否则可选的 id 等字段会永远校验失败。
    raw[key] = formData.get(key) ?? undefined;
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? t.validation.invalidInput };
  }
  return { ok: true, data: parsed.data };
}

/** Parse localized fields shaped like `zh_name` / `en_name` */
export function parseLocaleFields<S extends AnyZodObject>(
  schema: S,
  locale: AdminLocale,
  formData: FormData,
  t: AdminMessages,
): ParseResult<z.infer<S>> {
  const raw: Record<string, unknown> = {};
  for (const key of Object.keys(schema.shape)) {
    raw[key] = formData.get(`${locale}_${key}`);
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const localeLabel = getContentLocaleLabel(t, locale);
    return {
      ok: false,
      message: `${localeLabel}: ${parsed.error.issues[0]?.message ?? t.validation.invalidInput}`,
    };
  }
  return { ok: true, data: parsed.data };
}
