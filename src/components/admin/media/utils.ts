/**
 * 媒体库客户端/服务端共用的纯函数（不含 JSX，可安全用于客户端组件）。
 *
 * 只引用「类型」形式的字典与语言定义，编译后不会把服务端模块带进客户端包。
 */
import type { AdminMessages } from '@/lib/admin/i18n';
import type { AdminLocale } from '@/lib/admin/validation';

/** 人类可读的文件体积 */
export function formatFileSize(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** 尺寸展示：`1920 × 1080` */
export function formatDimensions(width: number | null, height: number | null): string {
  if (!width || !height) return '—';
  return `${width} × ${height}`;
}

type LocalizedField = 'title' | 'name' | 'alt' | 'caption';

interface LocalizedTranslation {
  locale: string;
  title?: string | null;
  name?: string | null;
  alt?: string | null;
  caption?: string | null;
}

/** 按后台界面语言 → 中文 → 英文 → 越南语的顺序取多语言字段 */
export function pickLocalizedText(
  translations: LocalizedTranslation[],
  field: LocalizedField,
  locale: AdminLocale,
): string {
  for (const target of [locale, 'zh', 'en', 'vi'] as const) {
    const value = translations.find((item) => item.locale === target)?.[field];
    if (value) return value;
  }
  return '';
}

/**
 * 上传接口返回的错误码 → 可读文案。
 * 服务端始终是权威校验方，客户端的体积/类型预检查只是提前告知。
 */
export function describeUploadError(code: string, t: AdminMessages): string {
  switch (code) {
    case 'TOO_LARGE':
      return `${t.media.uploadFailed} (TOO_LARGE) · ${t.media.limits}`;
    case 'UNSUPPORTED_TYPE':
      return `${t.media.uploadFailed} (UNSUPPORTED_TYPE) · ${t.media.limits}`;
    case 'UNAUTHORIZED':
      return t.actions.sessionExpired;
    case 'DB_UNAVAILABLE':
      return t.actions.dbUnavailable;
    default:
      return `${t.media.uploadFailed} (${code})`;
  }
}
