import { z } from 'zod';
import { ADMIN_LOCALES, type AdminLocale } from '@/lib/admin/validation';
import { localizedRecord } from '@/lib/i18n/localized';
import { SLUG_PATTERN } from '@/lib/slug';

/**
 * 页面编辑草稿的形状，同时也是版本快照（`PageVersion.snapshot`）的形状。
 *
 * 与商品刻意保持同一套做法（见 `product-draft.ts`）：
 *   - 线上内容在关系表里（`Page`、`PageTranslation`、`PageBlock`、`PageBlockTranslation`），
 *     前台只读它们；
 *   - 编辑先落进 `Page.draftData`，客人永远看不到改到一半的样子；
 *   - null 表示没有待发布的改动，此时编辑器直接编辑线上内容；
 *   - 发布是唯一把草稿写进线上的地方，发布留一版快照。
 *
 * 本模块是**纯的**：不碰 Prisma、不碰数据库，客户端与服务端都能引。
 */

export interface PageTranslationValues {
  title: string;
  seoTitle: string;
  seoDescription: string;
}

export interface PageBlockTranslationValues {
  title: string;
  subtitle: string;
  body: string;
  /** 按钮上的文字 —— 要翻译 */
  ctaLabel: string;
  /**
   * 按钮指向的地址 —— **不翻译**。
   *
   * 链接是结构不是文案，翻它只会翻出一个 404。模型那边也从来不收到这个字段。
   */
  ctaHref: string;
}

export interface PageBlockDraft {
  /** 线上区块的主键；草稿里新增的为 null。发布时据此决定更新还是新建 */
  id: string | null;
  /** 语义标识（hero / capabilities / …），页面内唯一 */
  key: string;
  enabled: boolean;
  sortOrder: number;
  values: Record<AdminLocale, PageBlockTranslationValues>;
}

export interface PageDraft {
  slug: string;
  /** 页面自身的标题与 SEO */
  translations: Record<AdminLocale, PageTranslationValues>;
  /** 数组顺序即前台展示顺序 */
  blocks: PageBlockDraft[];
}

export function emptyPageTranslationValues(): PageTranslationValues {
  return { title: '', seoTitle: '', seoDescription: '' };
}

export function emptyPageTranslations(): Record<AdminLocale, PageTranslationValues> {
  return localizedRecord(() => emptyPageTranslationValues());
}

export function emptyBlockTranslationValues(): PageBlockTranslationValues {
  return { title: '', subtitle: '', body: '', ctaLabel: '', ctaHref: '' };
}

export function emptyBlockTranslations(): Record<AdminLocale, PageBlockTranslationValues> {
  return localizedRecord(() => emptyBlockTranslationValues());
}

// ---------------------------------------------------------------------------
// 读取
// ---------------------------------------------------------------------------

const pageTranslationShape = z.object({
  title: z.string().default(''),
  seoTitle: z.string().default(''),
  seoDescription: z.string().default(''),
});

const blockTranslationShape = z.object({
  title: z.string().default(''),
  subtitle: z.string().default(''),
  body: z.string().default(''),
  ctaLabel: z.string().default(''),
  ctaHref: z.string().default(''),
});

const pageDraftShape = z.object({
  slug: z.string().default(''),
  translations: z.object(
    Object.fromEntries(ADMIN_LOCALES.map((locale) => [locale, pageTranslationShape])) as Record<
      AdminLocale,
      typeof pageTranslationShape
    >,
  ),
  blocks: z
    .array(
      z.object({
        id: z.string().nullable().default(null),
        key: z.string().min(1).max(80),
        enabled: z.boolean().default(true),
        sortOrder: z.number().int().default(0),
        values: z.object(
          Object.fromEntries(ADMIN_LOCALES.map((locale) => [locale, blockTranslationShape])) as Record<
            AdminLocale,
            typeof blockTranslationShape
          >,
        ),
      }),
    )
    .max(100)
    .default([]),
});

/**
 * 读取草稿。形状不认识就返回 null —— 调用方据此回退到「直接编辑线上内容」，
 * 而不是抛错让整个后台页面打不开。与 `readDraft` 同一策略。
 */
export function readPageDraft(value: unknown): PageDraft | null {
  if (value === null || value === undefined) return null;
  const parsed = pageDraftShape.safeParse(value);
  if (!parsed.success) return null;
  return parsed.data as PageDraft;
}

// ---------------------------------------------------------------------------
// 发布前的校验
// ---------------------------------------------------------------------------

/**
 * 发布前的完整校验。与草稿保存刻意不同：草稿允许标题为空（编辑到一半必须存得下去），
 * 发布时要求中文标题存在，且每种语言「要么整行都没有内容、要么有标题」。
 *
 * 后者与商品同一条理由：`PageTranslation.title` 是 NOT NULL，而前台的按语言取用
 * 是按「有没有这一行」决定的 —— 放一个空标题过去，该语言页面就会渲染出空白标题，
 * 而不是回退。
 */
export function validatePageForPublish(
  draft: PageDraft,
  messages: { slugRequired: string; slugFormat: string; titleRequired: string; seoWithoutTitle: string },
): { ok: true } | { ok: false; message: string } {
  if (!draft.slug) return { ok: false, message: messages.slugRequired };
  if (!SLUG_PATTERN.test(draft.slug)) return { ok: false, message: messages.slugFormat };
  if (!draft.translations.zh.title.trim()) return { ok: false, message: messages.titleRequired };

  for (const locale of ADMIN_LOCALES) {
    const values = draft.translations[locale];
    if (values.title.trim()) continue;
    if (values.seoTitle.trim() || values.seoDescription.trim()) {
      return { ok: false, message: messages.seoWithoutTitle };
    }
  }

  return { ok: true };
}
