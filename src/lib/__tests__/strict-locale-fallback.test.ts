import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { localesWithContent, strictLocaleFallbackEnabled } from '@/lib/catalog';
import { resolveFallbackSeo } from '@/lib/product-metadata';
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


describe('英文兜底页面的 SEO 状态切换', () => {
  /**
   * 问题：`/ar/products/x` 显示的是英文内容。放任它被索引，搜索引擎会把它当成
   * 「阿拉伯语版本的 x」收进去 —— 同一个英文页面在索引里出现十次，每次挂一个
   * 不同的语言标签。这是标准的重复内容问题，代价是**每一个**都排不上去。
   *
   * 三条处理：noindex、canonical 指向英文本体、不进 hreflang 与 sitemap。
   * 等该语言自己的译文补齐，三条一起撤销 —— 下面测的就是这个切换。
   */
  const PATH = '/products/manli';

  test('正在显示英文兜底时：noindex + canonical 指向英文地址', () => {
    const seo = resolveFallbackSeo({
      locale: 'ar',
      fallbackLocale: 'en',
      path: PATH,
      strict: true,
    });

    assert.equal(seo.noindex, true, '没有阿拉伯语内容，就不该被当成阿拉伯语页面收录');
    assert.equal(seo.canonicalPath, `/en${PATH}`, '权重与收录归到真正承载这份内容的那个地址');
  });

  test('正在显示英文兜底时：阿拉伯语不进 hreflang（因此也不进 sitemap）', () => {
    process.env.STRICT_LOCALE_FALLBACK = 'true';
    const translations = rows(['zh', '满力'], ['en', 'Manli']);

    const available = localesWithContent(translations, locales);
    assert.equal(available.includes('ar'), false);
    assert.deepEqual(available, ['zh', 'en'], '只有这两种语言真的有内容');

    // sitemap 用的是同一个函数，所以「不进 hreflang」与「不进 sitemap」是同一件事
    assert.equal(available.includes('ar'), false);
  });

  test('该语言自己的译文到位后：noindex 撤销、canonical 回到自己', () => {
    const seo = resolveFallbackSeo({
      locale: 'ar',
      fallbackLocale: null,
      path: PATH,
      strict: true,
    });

    assert.equal(seo.noindex, false);
    assert.equal(seo.canonicalPath, `/ar${PATH}`);
  });

  test('该语言自己的译文到位后：加回 hreflang 与 sitemap', () => {
    process.env.STRICT_LOCALE_FALLBACK = 'true';
    const translations = rows(['zh', '满力'], ['en', 'Manli'], ['ar', 'مانلي']);

    const available = localesWithContent(translations, locales);
    assert.equal(available.includes('ar'), true);
    assert.deepEqual(available, ['zh', 'en', 'ar']);
  });

  test('一次切换的完整过程：兜底 → 补齐 → 恢复索引', () => {
    process.env.STRICT_LOCALE_FALLBACK = 'true';

    // 阶段一：只有中英，阿拉伯语页面显示英文
    const before = rows(['zh', '满力'], ['en', 'Manli']);
    const beforeSeo = resolveFallbackSeo({
      locale: 'ar',
      fallbackLocale: 'en',
      path: PATH,
      strict: true,
    });
    assert.equal(beforeSeo.noindex, true);
    assert.equal(localesWithContent(before, locales).includes('ar'), false);

    // 阶段二：阿拉伯语译文补齐
    const after = rows(['zh', '满力'], ['en', 'Manli'], ['ar', 'مانلي']);
    const afterSeo = resolveFallbackSeo({
      locale: 'ar',
      fallbackLocale: null,
      path: PATH,
      strict: true,
    });
    assert.equal(afterSeo.noindex, false);
    assert.equal(afterSeo.canonicalPath, `/ar${PATH}`);
    assert.equal(localesWithContent(after, locales).includes('ar'), true);
  });

  test('严格模式关闭时保持第一阶段行为：可索引、canonical 指向自己', () => {
    // 第一阶段部署要求「hreflang 与线上行为保持兼容状态」。
    // 此时兜底可能落到中文而不是英文，noindex 反而会把一批原本正常的地址摘出索引。
    const seo = resolveFallbackSeo({
      locale: 'ar',
      fallbackLocale: 'zh',
      path: PATH,
      strict: false,
    });

    assert.equal(seo.noindex, false);
    assert.equal(seo.canonicalPath, `/ar${PATH}`);
  });

  test('中文页面缺中文内容时也不因为兜底而 noindex（除非确实在显示别的语言）', () => {
    const seo = resolveFallbackSeo({
      locale: 'zh',
      fallbackLocale: null,
      path: PATH,
      strict: true,
    });
    assert.equal(seo.noindex, false);
    assert.equal(seo.canonicalPath, `/zh${PATH}`);
  });
});
