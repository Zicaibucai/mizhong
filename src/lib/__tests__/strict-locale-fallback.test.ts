import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { localesWithContent } from '@/lib/catalog';
import { locales, localeCodes } from '@/lib/i18n/config';

/**
 * 严格语言回退的规则测试。
 *
 * 背景：线上两个正式商品（tehsugouzi、manli）目前**只有中文翻译行**。
 * 旧的回退逻辑会把「任意一条翻译」当成兜底，于是阿拉伯语页面显示中文商品名，
 * 还对外生成一个 hreflang 说「这里就是阿拉伯语版本」—— 属于跨语言污染。
 *
 * 新的规则是：
 *   - 中文页面只认中文，没有中文内容就不显示；
 *   - 其它语言先看该语言，没有则回退**英文**；
 *   - 该语言与英文都没有 → 当作不存在（404），而不是随便抓一条。
 *
 * 这里的断言全部落在 `localesWithContent` 上 —— 它是目录、hreflang、面包屑
 * 共用的那一个判断。三处用同一个函数，才不会出现「列表里有、点进去 404」。
 *
 * 注意：把这套规则**部署上去**有个前提 —— 全站翻译必须先跑完。否则
 * 「2 个商品 × 10 种语言 = 20 个原本 200 的 URL 会变成 404」。所以这里是
 * 规则本身的测试，不是部署开关。
 */

function rows(...entries: [string, string][]) {
  return entries.map(([locale, name]) => ({ locale: locale as never, name }));
}

describe('严格回退：哪些语言算「真的有内容」', () => {
  test('只有中文时，除中文外一个语言都不算有内容', () => {
    const translations = rows(['zh', '特塑钩子']);
    const available = localesWithContent(translations, locales);

    assert.deepEqual(available, ['zh'], '只有中文内容时，hreflang 只该出现中文');
  });

  test('中文 + 英文时，英文可以兜底其余语言', () => {
    const translations = rows(['zh', '特塑钩子'], ['en', 'Plastic Hook']);
    const available = localesWithContent(translations, locales);

    assert.deepEqual(available, ['zh', 'en', ...locales.filter((l) => l !== 'zh' && l !== 'en')]);
    assert.equal(available.includes('ar'), true, '英文存在时，阿拉伯语页面显示英文而不是 404');
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
