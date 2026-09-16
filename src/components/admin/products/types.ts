import type { AdminLocale } from '@/lib/admin/validation';
import type { PickerAsset } from './asset-picker';
import type { GalleryItemData } from './gallery-editor';

/** Values of one `ProductTranslation` row (all strings, empty when unset). */
export interface ProductTranslationValues {
  name: string;
  shortDescription: string;
  description: string;
  sizeSummary: string;
  spec: string;
  application: string;
  seoTitle: string;
  seoDescription: string;
}

export interface ProductBasics {
  id: string;
  slug: string;
  sku: string;
  categoryId: string | null;
  featured: boolean;
  published: boolean;
  sortOrder: number;
  coverAssetId: string | null;
  hoverVideoAssetId: string | null;
  // ---- 价格与贸易信息 ----
  priceMode: 'NEGOTIABLE' | 'FIXED' | 'RANGE';
  currency: string;
  /** 金额是字符串：Decimal 不跨越服务端/客户端边界 */
  priceMin: string;
  priceMax: string;
  priceUnit: string;
  moq: string;
  moqUnit: string;
}

/** 一行结构化参数的全部语言值（客户端可编辑状态） */
export interface SpecRowValues {
  name: string;
  value: string;
}

export interface SpecRowData {
  /** 本地稳定 key，用于 React 列表；保存时不提交 */
  key: string;
  /** 数据库主键；新增行为 null */
  id: string | null;
  values: Record<AdminLocale, SpecRowValues>;
}

export interface CategoryOption {
  id: string;
  name: string;
}

/** Everything the product editor needs, flattened to plain JSON for the client boundary. */
export interface ProductEditorData {
  product: ProductBasics;
  translations: Record<AdminLocale, ProductTranslationValues>;
  specifications: SpecRowData[];
  categories: CategoryOption[];
  /** Enabled media-library images (cover picker). */
  coverAssets: PickerAsset[];
  /** Enabled media-library videos (hover video picker). */
  videoAssets: PickerAsset[];
  /** Enabled media-library images and videos (gallery picker). */
  galleryAssets: PickerAsset[];
  media: GalleryItemData[];
  previewHref: string;
}
