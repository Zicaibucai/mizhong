import type { CSSProperties } from 'react';
import type { Locale } from '@/lib/i18n/config';
import type { Dict } from '@/lib/i18n';
import type { ContactView } from '@/lib/content';
import { PUBLIC_CONTACTS } from '@/lib/contact-config';
import { deriveContactHref, sanitizeHref } from '@/lib/href';

/**
 * Preview 2.0 的视觉与联系工具集。
 * 正式站和 /[locale]/design-preview 共用，保证评审版与上线版一致。
 */

/** 把 CSS 自定义属性写进 style（React 的类型定义不接受任意 --var 键） */
export function cssVars(vars: Record<string, string | number>): CSSProperties {
  return vars as CSSProperties;
}

export interface PreviewChannel {
  /**
   * React key 用的唯一标识。
   *
   * 以前这里是 `'whatsapp' | 'email' | 'phone'` 的字面量联合，同时兼作图标查找的键 ——
   * 于是**每种类型只能有一条**：后台加三个邮箱，前台只显示一个。现在 key 唯一即可
   * （内容层的用 `类型-主键`），图标改按 `type` 查。
   */
  key: string;
  type: ContactView['type'];
  label: string;
  value: string;
  /**
   * 可点击地址；**可能为 null**。
   *
   * 微信号只能复制、地址只能看 —— 它们不该被当成「没有内容」而丢掉。
   * 为 null 时前台渲染成不可点的文字，而不是一个点下去什么都不发生的链接。
   */
  href: string | null;
  external: boolean;
}

/**
 * 询盘区展示顺序：WhatsApp → Email → Phone → 微信 → 地址。
 *
 * 这是**排序**，不是筛选 —— 每一种类型有几条就显示几条，同类型内保持后台的排序。
 * 以前这里被当成筛选用（每种类型只取第一条），结果是后台加了三个邮箱只显示一个、
 * 加了微信永远不显示。后台填了就该看得到。
 */
const CHANNEL_ORDER = [
  { type: 'WHATSAPP', external: true },
  { type: 'EMAIL', external: false },
  { type: 'PHONE', external: false },
  { type: 'WECHAT', external: false },
  { type: 'ADDRESS', external: false },
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
    WECHAT: t.contact.wechat,
    ADDRESS: t.contact.address,
  };
  const rank = new Map<string, number>(CHANNEL_ORDER.map((entry, index) => [entry.type, index]));
  const isExternal = new Map<string, boolean>(CHANNEL_ORDER.map((entry) => [entry.type, entry.external]));

  /**
   * 后台内容层里全部可用的联系方式 —— 有几条就是几条，不再每类只取一条。
   *
   * 只要求「有值」：**没有链接也算**（微信号、地址）。以前要求必须有 href，
   * 于是后台填了微信、前台什么都没有。
   */
  const fromContent: PreviewChannel[] = contacts
    .filter((item) => rank.has(item.type) && item.value.trim().length > 0)
    .map((item) => ({
      key: `${item.type}-${item.id}`,
      type: item.type,
      label: item.label || labels[item.type],
      value: item.value,
      href: item.href,
      external: isExternal.get(item.type) ?? false,
    }));

  /** 某一类型在后台一条都没有时，用已确认的公开联系方式顶上 —— 询盘区不该空着 */
  const fromFallback: PreviewChannel[] = CHANNEL_ORDER.flatMap(({ type, external }) => {
    if (fromContent.some((channel) => channel.type === type)) return [];
    const fallback = PUBLIC_CONTACTS.find((item) => item.type === type && item.enabled);
    if (!fallback) return [];
    const href = sanitizeHref(fallback.href) ?? deriveContactHref(type, fallback.value) ?? '';
    if (!href) return [];
    return [
      {
        key: `fallback-${type}`,
        type,
        label: labels[type],
        value: fallback.value,
        href,
        external,
      },
    ];
  });

  // 类型之间按固定的触达优先级；同类型内保持后台的 sortOrder
  // （sort 是稳定的，所以 `fromContent` 里已经排好的顺序不会被打乱）
  return [...fromContent, ...fromFallback].sort((a, b) => (rank.get(a.type) ?? 99) - (rank.get(b.type) ?? 99));
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
 * 站内链接补语言前缀：直接复用公共实现 `@/lib/href` 的 withLocale，
 * 正式站与预览页共用同一套判断，不做第二份拷贝。
 */
export { withLocale } from '@/lib/href';

/**
 * 询盘入口：优先使用可预填主题的邮件地址，其次 WhatsApp，
 * 最后回退到页内锚点（保证按钮永远有去处）。
 */
export function inquiryHref(channels: PreviewChannel[], subject: string, anchor = '#inquiry'): string {
  const email = channels.find((channel) => channel.type === 'EMAIL');
  if (email?.href?.startsWith('mailto:')) {
    const [address] = email.href.replace(/^mailto:/, '').split('?');
    return `mailto:${address}?subject=${encodeURIComponent(subject)}`;
  }

  const whatsapp = channels.find((channel) => channel.type === 'WHATSAPP');
  if (whatsapp?.href) return whatsapp.href;

  return anchor;
}
