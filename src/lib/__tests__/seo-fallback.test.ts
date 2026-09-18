import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { resolveSeo } from '@/lib/seo-fallback';
import { emptyTranslationValues } from '@/lib/product-draft';
import type { ProductTranslationValues } from '@/lib/product-draft';

function values(partial: Partial<ProductTranslationValues>): ProductTranslationValues {
  return { ...emptyTranslationValues(), ...partial };
}

describe('SEO 标题与描述的回退逻辑', () => {
  test('人工填写的 SEO 标题优先', () => {
    const result = resolveSeo(values({ name: '商品名', seoTitle: '手填标题' }));
    assert.equal(result.title, '手填标题');
    assert.equal(result.titleIsFallback, false);
  });

  test('SEO 标题为空时回退到该语言的商品名称', () => {
    const result = resolveSeo(values({ name: '商品名' }));
    assert.equal(result.title, '商品名');
    assert.equal(result.titleIsFallback, true);
  });

  test('名称也为空时标题保持为空', () => {
    const result = resolveSeo(values({}));
    assert.equal(result.title, '');
    assert.equal(result.titleIsFallback, false);
  });

  test('描述为空时回退到该语言的一句话介绍', () => {
    const result = resolveSeo(values({ name: '商品名', shortDescription: '一句话' }));
    assert.equal(result.description, '一句话');
    assert.equal(result.descriptionIsFallback, true);
  });

  test('人工填写的描述优先于一句话介绍', () => {
    const result = resolveSeo(values({ shortDescription: '一句话', seoDescription: '手填描述' }));
    assert.equal(result.description, '手填描述');
    assert.equal(result.descriptionIsFallback, false);
  });

  test('描述与简介都为空时保持为空', () => {
    const result = resolveSeo(values({ name: '商品名' }));
    assert.equal(result.description, '');
    assert.equal(result.descriptionIsFallback, false);
  });

  test('标题与描述各自独立回退，互不影响', () => {
    const result = resolveSeo(values({ name: '商品名', seoDescription: '手填描述' }));
    assert.equal(result.title, '商品名');       // 标题回退
    assert.equal(result.description, '手填描述'); // 描述不回退
  });

  test('只有空白字符视为「未填写」', () => {
    const result = resolveSeo(values({ name: '商品名', seoTitle: '   ', seoDescription: '\n' }));
    assert.equal(result.title, '商品名');
    assert.equal(result.titleIsFallback, true);
    assert.equal(result.description, '');
  });

  test('绝不跨语言回退：英文名不会出现在中文标题里', () => {
    // 中文名称与 SEO 都为空 —— 即使别的语言有内容，中文 SEO 也必须保持为空。
    // resolveSeo 只看传入的那一种语言，所以这里天然满足；这条测试锁住这个契约。
    const result = resolveSeo(values({}));
    assert.equal(result.title, '');
    assert.equal(result.description, '');
  });
});
