import type { AdminLocale } from '@/lib/admin/validation';
import type { DraftSection, ProductTranslationValues } from '@/lib/product-draft';
import type { PickerAsset } from './asset-picker';
import type { GalleryItemData } from './gallery-editor';

/**
 * 一个语言下的全部可编辑文本字段。
 *
 * 定义在 `src/lib/product-draft.ts`（与草稿、版本快照共用同一份类型），这里只做转出，
 * 免得后台各处再从别处 import 一遍、或不小心又抄一份出来。
 */
export type { ProductTranslationValues };

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

/** 版本历史里的一条，已经摊平成可以直接渲染的字符串 */
export interface ProductVersionData {
  id: string;
  kind: 'PUBLISHED' | 'MANUAL';
  /** ISO 字符串：日期格式化在客户端做，服务端不猜时区 */
  createdAt: string;
  note: string | null;
  /** 操作人邮箱（账号可能已被删除，此时为 null） */
  createdBy: string | null;
  /** 那一版的产品名与价格，用来在列表里一眼认出是哪一版 */
  snapshotName: string;
  snapshotPrice: string;
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

  // ---- 草稿与版本 ----
  /** 相对线上内容改了哪几块（空数组 = 没有待发布的改动） */
  pendingChanges: DraftSection[];
  /** 不满足发布条件时列出原因；为空表示可以发布 */
  publishBlockers: string[];
  /** 最近三个历史版本，新的在前 */
  versions: ProductVersionData[];
  /** 草稿最后一次自动保存的时间（ISO），没有草稿时为 null */
  draftUpdatedAt: string | null;
}
