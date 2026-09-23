import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { brandAlternateNames, organizationJsonLd, websiteJsonLd } from '@/lib/structured-data';
import type { ContactView } from '@/lib/content';

const contacts: ContactView[] = [
  { id: '1', type: 'EMAIL', label: 'Email', value: 'sales@example.com', href: 'mailto:sales@example.com' },
  { id: '2', type: 'PHONE', label: 'Phone', value: '+8613800000000', href: 'tel:+8613800000000' },
  { id: '3', type: 'WECHAT', label: 'WeChat', value: 'sofa_materials', href: null },
  { id: '4', type: 'WHATSAPP', label: 'WhatsApp', value: '8613800000000', href: 'https://wa.me/8613800000000' },
];

function base(overrides: Partial<Parameters<typeof organizationJsonLd>[0]> = {}) {
  return organizationJsonLd({
    locale: 'en',
    url: 'https://example.com',
    name: 'Mizhong New Materials Co., Ltd.',
    legalName: 'Mizhong New Materials Co., Ltd.',
    contacts,
    ...overrides,
  });
}

describe('Organization 结构化数据', () => {
  test('名称、法定名称、站点地址都在', () => {
    const data = base();
    assert.equal(data['@type'], 'Organization');
    assert.equal(data.name, 'Mizhong New Materials Co., Ltd.');
    assert.equal(data.legalName, 'Mizhong New Materials Co., Ltd.');
    assert.equal(data.url, 'https://example.com');
  });

  test('别名覆盖中英文，便于引擎把两种写法对到同一实体', () => {
    const zh = base({ locale: 'zh' });
    assert.ok(zh.alternateName.includes('米众'));
    assert.ok(zh.alternateName.includes('Mizhong New Materials'));
    const en = brandAlternateNames('en');
    assert.ok(en.includes('Mizhong'));
  });

  test('有邮箱与电话时生成 contactPoint，并列出全部语言', () => {
    const data = base();
    assert.ok(Array.isArray(data.contactPoint));
    const point = data.contactPoint?.[0];
    assert.equal(point?.email, 'sales@example.com');
    assert.equal(point?.telephone, '+8613800000000');
    assert.ok((point?.availableLanguage as string[]).includes('zh-CN'));
  });

  test('没有邮箱与电话时不写 contactPoint', () => {
    const data = base({ contacts: contacts.filter((row) => row.type === 'WECHAT') });
    assert.equal(data.contactPoint, undefined);
  });

  test('sameAs 只收 http(s) 链接，mailto/tel 不算对外主页', () => {
    const data = base();
    assert.deepEqual(data.sameAs, ['https://wa.me/8613800000000']);
  });

  test('只写已知为真的字段：不编造 address / image', () => {
    const data = base() as Record<string, unknown>;
    assert.equal('address' in data, false);
    assert.equal('image' in data, false);
    const withImage = base({ image: 'https://example.com/brand.jpg' }) as Record<string, unknown>;
    assert.equal(withImage.image, 'https://example.com/brand.jpg');
  });
});

describe('WebSite 结构化数据', () => {
  test('SearchAction 指向真实的站内搜索页，参数名与页面一致', () => {
    const data = websiteJsonLd({ locale: 'zh', url: 'https://example.com', name: '米众新材料有限公司' });
    assert.equal(data.url, 'https://example.com/zh');
    assert.equal(
      data.potentialAction.target.urlTemplate,
      'https://example.com/zh/search?q={search_term_string}',
    );
    assert.equal(data.potentialAction['query-input'], 'required name=search_term_string');
  });

  test('inLanguage 使用项目既有的语言代码', () => {
    assert.equal(websiteJsonLd({ locale: 'zh', url: 'https://example.com', name: 'x' }).inLanguage, 'zh-CN');
    assert.equal(websiteJsonLd({ locale: 'pt', url: 'https://example.com', name: 'x' }).inLanguage, 'pt');
  });
});
