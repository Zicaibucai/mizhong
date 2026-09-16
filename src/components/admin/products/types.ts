import type { AdminLocale } from '@/lib/admin/validation';
import type { PickerAsset } from './asset-picker';
import type { GalleryItemData } from './gallery-editor';

/** Values of one `ProductTranslation` row (all strings, empty when unset). */
export interface ProductTranslationValues {
  name: string;
  shortDescription: string;
  description: string;
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
}

export interface CategoryOption {
  id: string;
  name: string;
}

/** Everything the product editor needs, flattened to plain JSON for the client boundary. */
export interface ProductEditorData {
  product: ProductBasics;
  translations: Record<AdminLocale, ProductTranslationValues>;
  categories: CategoryOption[];
  /** Enabled media-library images (cover picker). */
  coverAssets: PickerAsset[];
  /** Enabled media-library images and videos (gallery picker). */
  galleryAssets: PickerAsset[];
  media: GalleryItemData[];
  previewHref: string;
}
