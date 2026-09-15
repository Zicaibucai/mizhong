import { cache } from 'react';
import type { Locale } from '@/lib/i18n/config';
import { getDictionary, type Dict } from '@/lib/i18n';
import { companyName } from '@/lib/site-config';
import { PUBLIC_CONTACTS } from '@/lib/contact-config';
import { tryDb } from '@/lib/db';
import { deriveContactHref, sanitizeHref, type ContactTypeName } from './href';

export const BLOCK_KEYS = ['hero', 'capabilities', 'products', 'supply', 'quality', 'inquiry'] as const;
export type BlockKey = (typeof BLOCK_KEYS)[number];

export interface ContactView {
  id: string;
  type: ContactTypeName;
  label: string;
  value: string;
  href: string | null;
}

export interface NavView {
  id: string;
  label: string;
  href: string;
  external: boolean;
}

export interface CompanyView {
  name: string;
  tagline: string;
  about: string;
  positioning: string;
  address: string;
  businessHours: string;
  seoTitle: string;
  seoDescription: string;
}

export interface BlockView {
  key: string;
  enabled: boolean;
  title: string;
  subtitle: string;
  body: string;
  ctaLabel: string;
  ctaHref: string;
}

export interface SiteContent {
  /** 内容来源：database 表示数据库可用（可能部分字段仍回退字典） */
  source: 'database' | 'fallback';
  company: CompanyView;
  contacts: ContactView[];
  nav: NavView[];
  blocks: Record<string, BlockView>;
}

/** 首页区块的字典默认值（数据库无内容时使用） */
function defaultBlocks(t: Dict): Record<string, BlockView> {
  const base = (key: BlockKey, title: string, subtitle: string, ctaLabel = '', ctaHref = ''): BlockView => ({
    key,
    enabled: true,
    title,
    subtitle,
    body: '',
    ctaLabel,
    ctaHref,
  });

  return {
    hero: base(
      'hero',
      `${t.hero.titleLine1}\n${t.hero.titleLine2}`,
      t.hero.subtitle,
      t.hero.ctaPrimary,
      '#products',
    ),
    capabilities: base('capabilities', t.capabilities.title, t.capabilities.subtitle),
    products: base('products', t.products.title, t.products.subtitle, t.products.cta, '#inquiry'),
    supply: base('supply', t.supply.title, t.supply.subtitle),
    quality: base('quality', t.quality.title, t.quality.subtitle),
    inquiry: base('inquiry', t.inquiry.title, t.inquiry.subtitle, t.inquiry.cta, ''),
  };
}

/** 默认导航（数据库未配置时使用，保持与首页区块锚点一致） */
function defaultNav(t: Dict): NavView[] {
  return [
    { id: 'n-products', label: t.nav.products, href: '#products', external: false },
    { id: 'n-supply', label: t.nav.supply, href: '#supply', external: false },
    { id: 'n-quality', label: t.nav.quality, href: '#quality', external: false },
    { id: 'n-contact', label: t.nav.contact, href: '#inquiry', external: false },
  ];
}

/** 数据库不可用时的联系方式回退：使用已确认的公开真实联系方式（非占位假数据） */
function fallbackContacts(t: Dict): ContactView[] {
  const labels: Partial<Record<ContactTypeName, string>> = {
    EMAIL: t.contact.email,
    WHATSAPP: t.contact.whatsapp,
    PHONE: t.contact.phone,
    WECHAT: t.contact.wechat,
    ADDRESS: t.contact.address,
  };

  return PUBLIC_CONTACTS.filter((contact) => contact.enabled).map((contact) => ({
    id: `fallback-${contact.key}`,
    type: contact.type,
    label: labels[contact.type] ?? contact.type,
    value: contact.value,
    href: sanitizeHref(contact.href) ?? deriveContactHref(contact.type, contact.value),
  }));
}

function buildFallback(locale: Locale, t: Dict): SiteContent {
  return {
    source: 'fallback',
    company: {
      name: companyName(locale),
      tagline: t.footer.tagline,
      about: '',
      positioning: '',
      address: '',
      businessHours: '',
      seoTitle: '',
      seoDescription: t.meta.description,
    },
    contacts: fallbackContacts(t),
    nav: defaultNav(t),
    blocks: defaultBlocks(t),
  };
}

/**
 * 读取站点内容：优先数据库，缺失或不可用时回退到内置字典。
 * 按请求缓存，避免同一请求内重复查询。
 */
export const getSiteContent = cache(async (locale: Locale): Promise<SiteContent> => {
  const t = getDictionary(locale);
  const fallback = buildFallback(locale, t);

  const data = await tryDb(async (db) => {
    const [profile, contacts, navItems, homePage] = await Promise.all([
      db.companyProfile.findFirst({
        where: { slug: 'primary' },
        include: { translations: true },
      }),
      db.contactMethod.findMany({
        where: { enabled: true },
        orderBy: { sortOrder: 'asc' },
        include: { translations: true },
      }),
      db.navItem.findMany({
        where: { enabled: true },
        orderBy: { sortOrder: 'asc' },
        include: { translations: true },
      }),
      db.page.findFirst({
        where: { isHome: true },
        include: { translations: true, blocks: { include: { translations: true } } },
      }),
    ]);
    return { profile, contacts, navItems, homePage };
  });

  if (!data) return fallback;

  // ---- 公司资料 ----
  const profileTr = data.profile?.translations.find((row) => row.locale === locale);
  const company: CompanyView = {
    name: profileTr?.name?.trim() || fallback.company.name,
    tagline: profileTr?.tagline?.trim() || fallback.company.tagline,
    about: profileTr?.about?.trim() ?? '',
    positioning: profileTr?.positioning?.trim() ?? '',
    address: profileTr?.address?.trim() ?? '',
    businessHours: profileTr?.businessHours?.trim() ?? '',
    seoTitle: profileTr?.seoTitle?.trim() ?? '',
    seoDescription: profileTr?.seoDescription?.trim() || fallback.company.seoDescription,
  };

  // ---- 联系方式：仅展示已启用且填写了值的项，绝不用占位数据兜底 ----
  const contactLabels: Record<ContactTypeName, string> = {
    EMAIL: t.contact.email,
    WHATSAPP: t.contact.whatsapp,
    PHONE: t.contact.phone,
    WECHAT: t.contact.wechat,
    ADDRESS: t.contact.address,
  };
  const contacts: ContactView[] = data.contacts
    .map((row) => {
      const tr = row.translations.find((item) => item.locale === locale);
      const value = (tr?.value ?? row.value ?? '').trim();
      const label = (tr?.label ?? '').trim() || contactLabels[row.type];
      const safeHref = sanitizeHref(row.href) ?? deriveContactHref(row.type, value);
      return { id: row.id, type: row.type, label, value, href: safeHref };
    })
    .filter((item) => item.value.length > 0);

  // ---- 导航 ----
  const nav: NavView[] = data.navItems
    .map((row) => {
      const tr = row.translations.find((item) => item.locale === locale);
      const href = sanitizeHref(row.href) ?? '';
      return { id: row.id, label: tr?.label?.trim() ?? '', href, external: row.external };
    })
    .filter((item) => item.label.length > 0 && item.href.length > 0);

  // ---- 首页区块：仅当页面已发布时生效，否则回退字典 ----
  const defaults = defaultBlocks(t);
  const blocks: Record<string, BlockView> = { ...defaults };

  if (data.homePage?.status === 'PUBLISHED') {
    for (const block of data.homePage.blocks) {
      const tr = block.translations.find((item) => item.locale === locale);
      const fallbackBlock = defaults[block.key];
      if (!tr && !fallbackBlock) continue;
      blocks[block.key] = {
        key: block.key,
        enabled: block.enabled,
        title: tr?.title?.trim() || fallbackBlock?.title || '',
        subtitle: tr?.subtitle?.trim() || fallbackBlock?.subtitle || '',
        body: tr?.body?.trim() || '',
        ctaLabel: tr?.ctaLabel?.trim() || fallbackBlock?.ctaLabel || '',
        ctaHref: sanitizeHref(tr?.ctaHref) ?? fallbackBlock?.ctaHref ?? '',
      };
    }
  }

  return {
    source: 'database',
    company,
    contacts,
    nav: nav.length > 0 ? nav : fallback.nav,
    blocks,
  };
});

/** 取单个区块，始终返回可用对象 */
export function getBlock(content: SiteContent, key: BlockKey): BlockView {
  return (
    content.blocks[key] ?? {
      key,
      enabled: true,
      title: '',
      subtitle: '',
      body: '',
      ctaLabel: '',
      ctaHref: '',
    }
  );
}
