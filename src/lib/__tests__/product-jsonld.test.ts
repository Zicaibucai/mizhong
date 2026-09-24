import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { productJsonLd } from '@/lib/product-jsonld';
import type { ProductDetailView } from '@/lib/catalog';

/**
 * 商品结构化数据的规则。
 *
 * 锁住的核心是**「面议商品不伪造 Offer」**这条：Google 会为此在 GSC 报
 * 「应指定 offers、review 或 aggregateRating」，那是**资格提示**（不出富媒体卡片），
 * 不是处罚 —— 编价格或编评分才是真正要避免的事。
 */

/** 夹具：只填被测函数真正读到的字段，其余用不到（故 cast） */
function product(overrides: Partial<ProductDetailView> = {}): ProductDetailView {
  return {
    slug: 'hd6001_styrofoam_edge_rope',
    sku: 'HD6001',
    name: 'Round Styrofoam Edge Rope',
    shortDescription: 'A round foam-molded edge strip.',
    categoryName: 'Edge Rope & Welt Cord',
    coverUrl: '/media/image/2026/09/cover.jpg',
    gallery: [],
    priceMode: 'NEGOTIABLE',
    currency: 'USD',
    priceMin: null,
    priceMax: null,
    priceUnit: null,
    moq: null,
    moqUnit: null,
    specifications: [],
    specificationTable: null,
    ...overrides,
  } as unknown as ProductDetailView;
}

const BASE = 'https://htd123.com';

describe('商品结构化数据', () => {
  test('面议商品不输出 offers —— 不伪造价格', () => {
    const data = productJsonLd(product(), 'en', BASE) as Record<string, unknown>;
    assert.equal(data['@type'], 'Product');
    assert.equal('offers' in data, false);
  });

  test('填了真实价格才出现 offers（固定价）', () => {
    const data = productJsonLd(
      product({ priceMode: 'FIXED', priceMin: '2.50', priceUnit: 'meter' }),
      'en',
      BASE,
    ) as { offers?: Record<string, unknown> };
    assert.equal(data.offers?.price, '2.50');
    assert.equal(data.offers?.priceCurrency, 'USD');
    assert.equal(data.offers?.availability, 'https://schema.org/InStock');
  });

  test('区间价格带上 min/max，且不与单价重复', () => {
    const data = productJsonLd(
      product({ priceMode: 'RANGE', priceMin: '2.50', priceMax: '3.20' }),
      'en',
      BASE,
    ) as { offers?: Record<string, unknown> };
    assert.equal(data.offers?.price, '2.50');
    const spec = data.offers?.priceSpecification as Record<string, unknown> | undefined;
    assert.equal(spec?.minPrice, '2.50');
    assert.equal(spec?.maxPrice, '3.20');
  });

  test('品牌用公司名，并按语言取值', () => {
    const en = productJsonLd(product(), 'en', BASE) as { brand?: { name?: string } };
    assert.equal(en.brand?.name, 'Mizhong New Materials Co., Ltd.');
    const zh = productJsonLd(product(), 'zh', BASE) as { brand?: { name?: string } };
    assert.equal(zh.brand?.name, '米众新材料有限公司');
  });

  test('相对图片地址补成绝对地址（结构化数据必须给绝对 URL）', () => {
    const data = productJsonLd(
      product({ gallery: [{ type: 'image', url: '/media/image/2026/09/g1.jpg' }] as never }),
      'en',
      BASE,
    ) as { image?: string[] };
    assert.deepEqual(data.image, [
      'https://htd123.com/media/image/2026/09/cover.jpg',
      'https://htd123.com/media/image/2026/09/g1.jpg',
    ]);
  });

  test('型号进入 sku 字段（客户按型号找货）', () => {
    const data = productJsonLd(product(), 'en', BASE) as Record<string, unknown>;
    assert.equal(data.sku, 'HD6001');
  });
});
