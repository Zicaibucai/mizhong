import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { localesWithContent, strictLocaleFallbackEnabled } from '@/lib/catalog';
import { locales, localeCodes } from '@/lib/i18n/config';

/**
 * 严格语言回退的规则测试。
 *
 * 背景：线上两个正式商品（tehsugouzi、manli）目前**只有中文翻译行**。
 * 旧的回退逻辑会把「任意一条翻译」当成兜底，于是阿拉伯语页面显示中文商品名，
 * 还对外生成一个 hreflang 说「这里就是阿拉伯语版本」—— 属于跨语言污染。
 *
 * 新的规则分成两层，回答的是两个不同的问题：
 *
 *   - **渲染**（`pickTranslation`）：其它语言先看该语言，没有则回退英文；
 *     该语言与英文都没有 → 当作不存在（404）。
 *   - **hreflang 与 sitemap**（`localesWithContent`）：**只列有自己译文的语言**。
 *     一个显示英文内容的阿拉伯语页面，在 hreflang 里声明自己是阿拉伯语，
 *     等于告诉搜索引擎「这里是阿拉伯语内容」—— 比不声明更糟。
 *
 * **这套规则默认关闭**，由 `STRICT_LOCALE_FALLBACK` 环境变量控制，且
 * **只有严格等于 `'true'` 才开启**。原因是「2 个商品 × 10 种语言 = 20 个原本 200
 * 的 URL 会变成 404」——必须先翻译完再开启。所以这里既测开启后的规则，
 * 也测关闭时确实是旧行为（不能误上线）。
 */

const original = process.env.STRICT_LOCALE_FALLBACK;

beforeEach(() => {
  // 只有严格等于 'true' 才开启（见 catalog.ts 的说明）
  process.env.STRICT_LOCALE_FALLBACK = 'true';
});

afterEach(() => {
  if (original === undefined) delete process.env.STRICT_LOCALE_FALLBACK;
  else process.env.STRICT_LOCALE_FALLBACK = original;
});

function rows(...entries: [string, string][]) {
  return entries.map(([locale, name]) => ({ locale: locale as never, name }));
}

describe('开关', () => {
  test('默认关闭 —— 不设环境变量时必须是旧行为', () => {
    delete process.env.STRICT_LOCALE_FALLBACK;
    assert.equal(strictLocaleFallbackEnabled(), false, '不设变量时不能开启严格回退');
  });

  test('只有严格等于 "true" 才是开启', () => {
    process.env.STRICT_LOCALE_FALLBACK = 'true';
    assert.equal(strictLocaleFallbackEnabled(), true);
  });

  test('其余写法一律关闭 —— 这个开关一开，没有译文的 URL 会直接 404', () => {
    // `FOO=1` 与 `FOO=true` 在运维脚本里都很常见，一个拼写差异就足以把
    // 整站的一部分页面关掉。这种代价下「必须明确写 true」是刻意的。
    for (const value of ['', ' ', 'false', '0', '1', 'yes', 'no', 'TRUE', 'True', ' true', 'true ', 'on']) {
      process.env.STRICT_LOCALE_FALLBACK = value;
      assert.equal(strictLocaleFallbackEnabled(), false, `"${value}" 必须是关闭`);
    }
  });

  test('变量被删除后回到关闭', () => {
    process.env.STRICT_LOCALE_FALLBACK = 'true';
    assert.equal(strictLocaleFallbackEnabled(), true);
    delete process.env.STRICT_LOCALE_FALLBACK;
    assert.equal(strictLocaleFallbackEnabled(), false);
  });

  test('关闭时 hreflang 列出全部语言（线上现状不变）', () => {
    delete process.env.STRICT_LOCALE_FALLBACK;
    const onlyChinese = rows(['zh', '特塑钩子']);
    assert.deepEqual(localesWithContent(onlyChinese, locales), [...locales]);
  });
});

describe('严格回退：哪些语言算「真的有内容」', () => {
  test('只有中文时，除中文外一个语言都不算有内容', () => {
    const translations = rows(['zh', '特塑钩子']);
    const available = localesWithContent(translations, locales);

    assert.deepEqual(available, ['zh'], '只有中文内容时，hreflang 只该出现中文');
  });

  test('中文 + 英文时只列这两种 —— 英文兜底的页面不算「有该语言内容」', () => {
    const translations = rows(['zh', '特塑钩子'], ['en', 'Plastic Hook']);
    const available = localesWithContent(translations, locales);

    assert.deepEqual(available, ['zh', 'en']);
    assert.equal(
      available.includes('ar'),
      false,
      '阿拉伯语页面即使会显示英文，也不该在 hreflang 里声称自己是阿拉伯语',
    );
  });

  test('全部语言都有内容时，十一种语言全部列出', () => {
    const translations = rows(...locales.map((locale) => [locale, `${locale} name`] as [string, string]));
    const available = localesWithContent(translations, locales);
    assert.deepEqual(available, [...locales]);
  });

  test('名称为空的翻译行不算内容 —— 空商品名比 404 更糟', () => {
    const translations = rows(['zh', '特塑钩子'], ['ar', '   ']);
    const available = localesWithContent(translations, locales);
    assert.equal(available.includes('ar'), false);
  });

  test('中文内容缺失时，中文自己也不列出', () => {
    const translations = rows(['en', 'Plastic Hook']);
    const available = localesWithContent(translations, locales);
    assert.equal(available.includes('zh'), false, '中文页面只认中文，没有就是没有');
    assert.equal(available.includes('en'), true);
  });

  test('没有任何翻译行时返回空 —— 调用方据此 404', () => {
    assert.deepEqual(localesWithContent([], locales), []);
  });
});

describe('hreflang 的构造', () => {
  test('只列出真实存在的语言，且用 BCP-47 代码', () => {
    const translations = rows(['zh', '特塑钩子']);
    const contentLocales = localesWithContent(translations, locales);

    const languages: Record<string, string> = {};
    for (const locale of contentLocales) languages[localeCodes[locale]] = `https://example.com/${locale}`;

    assert.deepEqual(languages, { 'zh-CN': 'https://example.com/zh' });
    assert.equal(Object.keys(languages).length, 1, '只有中文内容时不该声明十一种语言');
  });

  test('每种语言都有内容时，十一种语言各有一条 hreflang', () => {
    const translations = rows(...locales.map((locale) => [locale, `${locale} name`] as [string, string]));
    const contentLocales = localesWithContent(translations, locales);
    const codes = contentLocales.map((locale) => localeCodes[locale]);

    assert.equal(codes.length, locales.length);
    assert.equal(new Set(codes).size, locales.length, 'hreflang 代码不能重复');
    assert.ok(codes.includes('zh-CN'));
    assert.ok(codes.includes('ar'));
  });
});
