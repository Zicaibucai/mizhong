import { locales, localeCodes, type Locale } from '@/lib/i18n/config';
import type { ContactView } from '@/lib/content';

/**
 * Organization / WebSite 结构化数据（2026-09-23 补）。
 *
 * 为什么需要：在此之前全站只有商品页带 Product 结构化数据，**没有任何一处声明
 * 「htd123.com 属于哪家公司」**。搜索引擎识别品牌实体（知识面板、以及「某某公司
 * 是哪家」这类问法）依赖的正是 Organization：名称、法定名称、别名、联系方式。
 * 用户反馈「搜品牌名搜不到」时，这是**我们能控制的那一半**（另一半是外链与时间）。
 *
 * 只输出**已知为真**的字段：地址为空就不写 address，没有外链就不写 sameAs ——
 * 结构化数据里编内容，比不写更糟。
 */

/** 品牌名的各种写法，供引擎做实体对齐（中英文互相指向同一实体） */
export function brandAlternateNames(locale: Locale): string[] {
  const latin = ['Mizhong', 'Mizhong New Materials', 'Mizhong New Materials Co., Ltd.'];
  return locale === 'zh' ? ['米众新材料有限公司', '米众新材料', '米众', ...latin] : latin;
}

export interface OrganizationInput {
  locale: Locale;
  /** 站点根地址，如 https://htd123.com */
  url: string;
  /** 品牌名（页头显示的那个） */
  name: string;
  /** 法定全称 */
  legalName: string;
  contacts: readonly ContactView[];
  /** 品牌图（没有就省略该字段） */
  image?: string | null;
}

export function organizationJsonLd(input: OrganizationInput) {
  const email = input.contacts.find((contact) => contact.type === 'EMAIL')?.value?.trim();
  const phone = input.contacts.find((contact) => contact.type === 'PHONE')?.value?.trim();
  const sameAs = [
    ...new Set(
      input.contacts
        .map((contact) => contact.href)
        .filter((href): href is string => Boolean(href && /^https?:\/\//i.test(href))),
    ),
  ];

  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: input.name,
    legalName: input.legalName,
    alternateName: brandAlternateNames(input.locale),
    url: input.url,
    ...(input.image ? { image: input.image } : {}),
    ...(sameAs.length > 0 ? { sameAs } : {}),
    ...(email || phone
      ? {
          contactPoint: [
            {
              '@type': 'ContactPoint',
              contactType: 'sales',
              ...(email ? { email } : {}),
              ...(phone ? { telephone: phone } : {}),
              availableLanguage: locales.map((locale) => localeCodes[locale]),
            },
          ],
        }
      : {}),
  };
}

/**
 * WebSite 与站内搜索入口。
 *
 * SearchAction 指向真实的站内搜索页（`/[locale]/search?q=`），因此搜索框
 * 有可能直接出现在结果里；地址与真实路由一致，不做占位。
 */
export function websiteJsonLd(input: { locale: Locale; url: string; name: string }) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: input.name,
    url: `${input.url}/${input.locale}`,
    inLanguage: localeCodes[input.locale],
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${input.url}/${input.locale}/search?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };
}
