import type { CSSProperties } from 'react';
import type { Locale } from '@/lib/i18n/config';
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
