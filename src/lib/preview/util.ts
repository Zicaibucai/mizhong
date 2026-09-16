import type { CSSProperties } from 'react';
import type { Locale } from '@/lib/i18n/config';
import { locales } from '@/lib/i18n';
import type { Dict } from '@/lib/i18n';
import type { ContactView } from '@/lib/content';
import { PUBLIC_CONTACTS } from '@/lib/contact-config';
import { deriveContactHref, sanitizeHref } from '@/lib/href';

/**
 * 设计预览页专用工具集。
 *
 * 只被 /[locale]/design-preview 路由使用，不参与正式首页渲染。
 */

/** 把 CSS 自定义属性写进 style（React 的类型定义不接受任意 --var 键） */
export function cssVars(vars: Record<string, string | number>): CSSProperties {
  return vars as CSSProperties;
}

export interface PreviewChannel {
  key: 'whatsapp' | 'email' | 'phone';
  type: ContactView['type'];
  label: string;
  value: string;
  href: string;
  external: boolean;
}

/** 询盘区展示顺序：WhatsApp → Email → Phone，与运营确认的触达优先级一致 */
const CHANNEL_ORDER = [
  { key: 'whatsapp', type: 'WHATSAPP', external: true },
  { key: 'email', type: 'EMAIL', external: false },
  { key: 'phone', type: 'PHONE', external: false },
] as const;

/**
 * 汇总可直接触达的联系渠道。
 *
 * 优先使用内容层（后台可管理）的数据；某一类型在后台被停用或留空时，
 * 回退到 contact-config.ts 中已确认的公开联系方式，保证询盘区不会空着。
 * 这里的回退值同样是真实信息，不含任何占位假数据。
 */
export function resolveChannels(locale: Locale, t: Dict, contacts: ContactView[]): PreviewChannel[] {
  void locale;

  const labels: Record<string, string> = {
    WHATSAPP: t.contact.whatsapp,
    EMAIL: t.contact.email,
    PHONE: t.contact.phone,
  };

  return CHANNEL_ORDER.map(({ key, type, external }) => {
    const fromContent = contacts.find((item) => item.type === type && item.href && item.value.trim());

    if (fromContent?.href) {
      return {
        key,
        type,
        label: fromContent.label || labels[type],
        value: fromContent.value,
        href: fromContent.href,
        external,
      };
    }

    const fallback = PUBLIC_CONTACTS.find((item) => item.type === type && item.enabled);
    return {
      key,
      type,
      label: labels[type],
      value: fallback?.value ?? '',
      href: sanitizeHref(fallback?.href) ?? deriveContactHref(type, fallback?.value ?? '') ?? '',
      external,
    };
  }).filter((channel) => channel.value.length > 0 && channel.href.length > 0);
}

/**
 * 区块标题按语言分行。
 * 字典/后台里的标题用 \n 表示换行，这里保留分行信息交给遮罩动画逐行渲染。
 */
export function splitLines(title: string): string[] {
  return title
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

/** 两位序号：01 / 02 / … 用于编辑式编号 */
export function ordinal(index: number): string {
  return String(index + 1).padStart(2, '0');
}

/**
 * 给站内绝对路径补上语言前缀。
 *
 * 内容层里的导航地址是 `#anchor`、`/products` 这类与语言无关的写法
 * （正式站依赖 middleware 做 308 重定向）。预览页直接生成带前缀的地址，
 * 既少一跳重定向，也保证从商品页返回时仍停留在当前语言。
 */
export function withLocale(locale: Locale, href: string): string {
  const value = (href ?? '').trim();
  if (!value) return `/${locale}`;
  if (value.startsWith('#') || value.startsWith('//')) return value;
  if (!value.startsWith('/')) return value;

  const segments = value.split('/').filter(Boolean);
  if (locales.includes(segments[0] as Locale)) return value;
  return `/${locale}${value}`;
}

/**
 * 询盘入口：优先使用可预填主题的邮件地址，其次 WhatsApp，
 * 最后回退到页内锚点（保证按钮永远有去处）。
 */
export function inquiryHref(channels: PreviewChannel[], subject: string, anchor = '#inquiry'): string {
  const email = channels.find((channel) => channel.key === 'email');
  if (email?.href.startsWith('mailto:')) {
    const [address] = email.href.replace(/^mailto:/, '').split('?');
    return `mailto:${address}?subject=${encodeURIComponent(subject)}`;
  }

  const whatsapp = channels.find((channel) => channel.key === 'whatsapp');
  if (whatsapp?.href) return whatsapp.href;

  return anchor;
}
