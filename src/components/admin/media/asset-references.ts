/**
 * 素材引用检查（共享工具，非 React 组件）。
 *
 * 页面（删除前展示引用清单）与 Server Action（强制删除前的二次校验）共用同一份逻辑，
 * 保证「后台看到什么」与「服务端校验什么」始终一致 —— 绝不会静默打断前台页面。
 *
 * 之所以放在 components/admin/media/ 下：该目录是本工作流唯一可写的共享路径，
 * 且本文件不含任何 JSX，可被服务端组件、Server Action 与客户端组件安全引用。
 */
import type { AdminMessages } from '@/lib/admin/i18n';
import type { AdminLocale } from '@/lib/admin/validation';

/** 一条引用记录：`group` 为引用所在位置（已本地化），`label` 为被引用对象的可读名称 */
export interface AssetReference {
  group: string;
  label: string;
}

interface NamedTranslation {
  locale: string;
  name: string;
}

/** 素材被引用到的所有位置（与 prisma include 结构兼容，无需 Prisma 类型） */
export interface AssetReferenceSource {
  slots: { id: string; slot: string }[];
  productMedia: { product: { slug: string; translations: NamedTranslation[] } }[];
  productCovers: { slug: string; translations: NamedTranslation[] }[];
  /** 把本素材用作「列表悬停视频」的商品 */
  productHoverVideos: { slug: string; translations: NamedTranslation[] }[];
  categoryCovers: { slug: string; translations: NamedTranslation[] }[];
  /**
   * 把本素材用作封面的视频。
   * posterUrl 存的是 URL 而不是外键，因此这一项由调用方单独查询后附带传入。
   */
  posterOf?: { id: string; key: string; type: string }[];
}

/**
 * 名称回退顺序：后台界面语言 → 中文 → 英文 → 越南语 → slug。
 * （名称是专有名词，不做翻译，只按语言挑选）
 */
function pickName(translations: NamedTranslation[], locale: AdminLocale, fallback: string): string {
  for (const target of [locale, 'zh', 'en', 'vi'] as const) {
    const name = translations.find((item) => item.locale === target)?.name;
    if (name) return name;
  }
  return fallback;
}

/**
 * 汇总素材的全部引用。
 * 分组标题复用后台字典中已有的文案键，因此不会出现硬编码文案。
 */
export function collectAssetReferences(
  asset: AssetReferenceSource,
  locale: AdminLocale,
  t: AdminMessages,
): AssetReference[] {
  const references: AssetReference[] = [];

  for (const binding of asset.slots) {
    references.push({ group: t.media.slotsSection, label: binding.slot });
  }

  for (const item of asset.productMedia) {
    references.push({
      group: t.nav.products,
      label: pickName(item.product.translations, locale, item.product.slug),
    });
  }

  for (const product of asset.productCovers) {
    references.push({
      group: t.products.coverLabel,
      label: pickName(product.translations, locale, product.slug),
    });
  }

  // 悬停视频是商品的独立字段，被删除时必须一并提示，否则前台卡片会静默失去视频
  for (const product of asset.productHoverVideos) {
    references.push({
      group: t.products.hoverVideoLabel,
      label: pickName(product.translations, locale, product.slug),
    });
  }

  for (const category of asset.categoryCovers) {
    references.push({
      group: t.productCategories.cover,
      label: pickName(category.translations, locale, category.slug),
    });
  }

  for (const poster of asset.posterOf ?? []) {
    references.push({ group: t.media.posterLabel, label: poster.key });
  }

  return references;
}

/** 引用清单的可读摘要（用于 Server Action 的错误提示，逗号分隔） */
export function describeAssetReferences(references: AssetReference[]): string {
  return references.map((item) => `${item.group}: ${item.label}`).join('; ');
}
