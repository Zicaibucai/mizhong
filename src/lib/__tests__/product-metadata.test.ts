import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { resolveProductMetadata } from '@/lib/product-metadata';

/**
 * 前台 metadata 的回退规则。
 *
 * 这一组测试锁住的是需求里最容易被「只做了视觉」的那一条：
 * 后台灰色占位提示显示的，必须与前台 <title> / og:title 真正使用的完全一致。
 */

const base = {
  name: 'S型沙发特殊钩子',
  shortDescription: '不锈钢材质，承重 20 kg',
  seoTitle: null,
  seoDescription: null,
  coverUrl: '/media/cover.jpg',
  coverThumbnailUrl: '/media/cover-thumb.webp',
  coverAlt: null,
};

describe('前台商品 metadata 的回退', () => {
  test('SEO 标题为空时，真实 title 使用当前语言的商品名称', () => {
    assert.equal(resolveProductMetadata(base).title, 'S型沙发特殊钩子');
  });

  test('SEO 描述为空时，真实 description 使用当前语言的一句话介绍', () => {
    assert.equal(resolveProductMetadata(base).description, '不锈钢材质，承重 20 kg');
  });

  test('人工填写的 SEO 内容优先于回退值', () => {
    const meta = resolveProductMetadata({
      ...base,
      seoTitle: '手填标题',
      seoDescription: '手填描述',
    });
    assert.equal(meta.title, '手填标题');
    assert.equal(meta.description, '手填描述');
  });

  test('名称与简介也为空时，description 交给站点级默认值（undefined）而不是编一个', () => {
    const meta = resolveProductMetadata({
      ...base,
      name: '',
      shortDescription: null,
      seoTitle: null,
      seoDescription: null,
    });
    assert.equal(meta.title, '');
    assert.equal(meta.description, undefined);
  });

  test('只有空白字符视为「未填写」', () => {
    const meta = resolveProductMetadata({
      ...base,
      seoTitle: '   ',
      seoDescription: '\n\t',
    });
    assert.equal(meta.title, 'S型沙发特殊钩子');
    assert.equal(meta.description, '不锈钢材质，承重 20 kg');
  });

  test('绝不跨语言回退：这里只看传入的那一种语言', () => {
    // 阿拉伯语页面拿到的是阿拉伯语的 translation 行；即使它全空，
    // 也不会把中文内容顶上来 —— 中文内容根本不在入参里。
    const meta = resolveProductMetadata({
      ...base,
      name: '',
      shortDescription: null,
      seoTitle: null,
      seoDescription: null,
    });
    assert.equal(meta.title, '');
    assert.equal(meta.description, undefined);
  });

  test('封面用于 og:image，缺失时为 undefined', () => {
    assert.equal(resolveProductMetadata(base).image, '/media/cover.jpg');
    assert.equal(
      resolveProductMetadata({ ...base, coverUrl: null }).image,
      '/media/cover-thumb.webp',
    );
    assert.equal(
      resolveProductMetadata({ ...base, coverUrl: null, coverThumbnailUrl: null }).image,
      undefined,
    );
  });

  test('og:image 的替代文本回退到商品名称', () => {
    assert.equal(resolveProductMetadata(base).imageAlt, 'S型沙发特殊钩子');
    assert.equal(
      resolveProductMetadata({ ...base, coverAlt: '  挂钩特写  ' }).imageAlt,
      '挂钩特写',
    );
  });
});
