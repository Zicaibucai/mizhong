import { locales, type Locale } from '@/lib/i18n/config';

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

/**
 * 给站内绝对路径补上语言前缀，**全站唯一的语言链接函数**。
 *
 * 内容层（数据库与字典默认值）里的地址是 `/products` 这类与语言无关的写法，
 * 直接渲染会落到 middleware 的 308 重定向，并被带到**默认语言**——
 * 于是 /en 或 /vi 的访客点「产品」会掉回中文站。
 * 所有站内链接必须先经过这里，再交给 `<a>` / `<Link>`。
 *
 * 原样返回：页内锚点（`#inquiry`）、协议相对地址（`//…`）、
 * 绝对地址（http/https/mailto/tel）、外链，以及已经带语言前缀的路径。
 */
export function withLocale(locale: Locale, href: string | null | undefined): string {
  const value = (href ?? '').trim();
  if (!value) return `/${locale}`;
  if (!value.startsWith('/') || value.startsWith('//')) return value;

  const [first] = value.split('/').filter(Boolean);
  if (first && (locales as readonly string[]).includes(first)) return value;
  return `/${locale}${value}`;
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
