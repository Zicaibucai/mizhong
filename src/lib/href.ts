const ALLOWED_PROTOCOLS = new Set(['http:', 'https:', 'mailto:', 'tel:']);

/**
 * 规范化并校验链接地址，防止 `javascript:`、`data:`、协议相对 URL 等注入。
 * 仅允许：站内相对路径、页内锚点、http/https/mailto/tel 绝对地址。
 */
export function sanitizeHref(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const value = raw.trim();
  if (!value) return null;

  if (value.startsWith('#')) return value;
  if (value.startsWith('/')) {
    // 排除协议相对 URL（//evil.example.com）
    return value.startsWith('//') ? null : value;
  }

  try {
    const url = new URL(value);
    return ALLOWED_PROTOCOLS.has(url.protocol) ? url.toString() : null;
  } catch {
    return null;
  }
}

export type ContactTypeName = 'EMAIL' | 'WHATSAPP' | 'PHONE' | 'WECHAT' | 'ADDRESS';

/** 由联系方式类型与值推导可点击链接（无法安全推导时返回 null） */
export function deriveContactHref(type: ContactTypeName, value: string): string | null {
  const raw = value.trim();
  if (!raw) return null;

  switch (type) {
    case 'EMAIL':
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw) ? `mailto:${raw}` : null;
    case 'PHONE': {
      const cleaned = raw.replace(/[^\d+]/g, '');
      return cleaned.length >= 5 ? `tel:${cleaned}` : null;
    }
    case 'WHATSAPP': {
      const digits = raw.replace(/\D/g, '');
      return digits.length >= 7 ? `https://wa.me/${digits}` : null;
    }
    default:
      return null;
  }
}
