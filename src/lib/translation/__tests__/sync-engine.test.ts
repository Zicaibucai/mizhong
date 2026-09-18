import { test, describe, afterEach, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { locales, type Locale } from '@/lib/i18n/config';
import type { TranslationSettings } from '@/lib/translation/settings';
import { syncEntity } from '@/lib/translation/engine';
import { planSync } from '@/lib/translation/state';
import { createFakePrisma } from './fake-db';

/**
 * 同步引擎的行为测试。
 *
 * 这里验证的是需求里最容易被实现成「看起来对、其实每次都重翻」的那几条：
 * 只翻变了的字段、中文清空就清译文、没变化就一个请求都不发、
 * 嵌套结构按路径回填、部分失败不回退成功结果。
 *
 * 用的是内存假库 + 假 fetch（见 fake-db.ts 的说明）。引擎真正调用的
 * DeepSeek 客户端走的是和线上同一条代码路径，只是网络那一层被换掉了。
 */

const settings: TranslationSettings = {
  apiKey: 'sk-test-not-a-real-key',
  baseUrl: 'https://api.test/v1',
  model: 'deepseek-chat',
  source: 'database',
  keyStorage: 'encrypted',
};

interface RecordedCall {
  /** 本次请求包含的字段路径 */
  paths: string[];
  /** 本次请求包含的目标语言 */
  targets: string[];
  /** 路径 → 中文原文 */
  source: Record<string, string>;
}

let calls: RecordedCall[] = [];
const originalFetch = globalThis.fetch;

/** 从提示词里把「这次到底送了哪些字段、哪些语言」抠出来 —— 断言全靠它 */
function parsePrompt(userPrompt: string): RecordedCall {
  const targets = [...userPrompt.matchAll(/^- ([a-z]{2}): /gm)].map((match) => match[1]);
  const sourceJson = userPrompt.slice(userPrompt.lastIndexOf('原文：') + '原文：'.length);
  const { source } = JSON.parse(sourceJson) as { source: Record<string, string> };
  return { paths: Object.keys(source), targets, source };
}

/**
 * 换掉网络层。
 *
 * 默认行为：每个字段返回 `译:<原文>`，语言代码做前缀。这样测试可以一眼看出
 * 「这个位置写进去的是哪来的值」，也能验证译文确实按路径回了自己的位置。
 */
function stubDeepSeek(options: { failLocales?: string[]; status?: number } = {}) {
  globalThis.fetch = (async (_url: string, init: { body: string }) => {
    const body = JSON.parse(init.body) as { messages: { content: string }[] };
    const call = parsePrompt(body.messages[1].content);
    calls.push(call);

    const translations: Record<string, Record<string, string>> = {};
    for (const locale of locales) {
      if (locale === 'zh') continue;
      if (options.failLocales?.includes(locale)) continue;
      translations[locale] = Object.fromEntries(
        call.paths.map((path) => [path, `${locale}|${call.source[path]}`]),
      );
    }

    return {
      ok: true,
      status: 200,
      json: async () => ({ choices: [{ message: { content: JSON.stringify({ translations }) } }] }),
      text: async () => '',
    } as unknown as Response;
  }) as typeof fetch;
}

beforeEach(() => {
  calls = [];
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

/** 十一语言全空的取值表，用来拼规格表单元格等按语言存的文本 */
const wideValues = Object.fromEntries(locales.map((locale) => [locale, ''])) as Record<Locale, string>;

/** 一个只有中文的商品，带规格表与型号选项 —— 覆盖嵌套路径 */
function seedProduct() {
  return createFakePrisma({
    products: [
      {
        id: 'p1',
        slug: 'tehsugouzi',
        translations: {
          zh: {
            name: '特塑钩子',
            shortDescription: '一句话',
            description: '<p>带 <b>标签</b> 的正文，含 {占位符}</p>',
            seoTitle: 'SEO 标题',
          },
        },
        specTable: {
          columns: [
            { id: 'col_a', values: { zh: '材质', en: '', vi: '', es: '', ja: '', ru: '', ar: '', fr: '', ko: '', pt: '', hi: '' } },
            { id: 'col_b', values: { zh: '宽度', en: '', vi: '', es: '', ja: '', ru: '', ar: '', fr: '', ko: '', pt: '', hi: '' } },
          ],
          rows: [
            {
              id: 'row_1',
              cells: {
                col_a: { zh: '不锈钢', en: '', vi: '', es: '', ja: '', ru: '', ar: '', fr: '', ko: '', pt: '', hi: '' },
                col_b: { zh: '25 mm', en: '', vi: '', es: '', ja: '', ru: '', ar: '', fr: '', ko: '', pt: '', hi: '' },
              },
            },
            {
              id: 'row_2',
              cells: {
                col_a: { zh: '铝合金', en: '', vi: '', es: '', ja: '', ru: '', ar: '', fr: '', ko: '', pt: '', hi: '' },
                col_b: { zh: '30 mm', en: '', vi: '', es: '', ja: '', ru: '', ar: '', fr: '', ko: '', pt: '', hi: '' },
              },
            },
          ],
        },
        variantGroups: [
          {
            id: 'g1',
            values: { zh: '型号', en: '', vi: '', es: '', ja: '', ru: '', ar: '', fr: '', ko: '', pt: '', hi: '' },
            options: [
              {
                id: 'o1',
                assetId: null,
                values: { zh: '标准型', en: '', vi: '', es: '', ja: '', ru: '', ar: '', fr: '', ko: '', pt: '', hi: '' },
              },
            ],
          },
        ],
      },
    ],
  });
}

describe('首次全语言同步', () => {
  test('一次请求就把十个语言全翻出来，写进草稿而不是线上', async () => {
    const fake = seedProduct();
    stubDeepSeek();

    const result = await syncEntity(fake.db, settings, 'product', 'p1');
    assert.ok(result);
    assert.equal(result.ok, true);
    assert.equal(result.nothingToDo, false);

    // 一次请求覆盖全部语言 —— 不是「一语言一请求」
    assert.equal(result.requestCount, 1);
    assert.deepEqual(calls[0].targets.sort(), ['ar', 'en', 'es', 'fr', 'hi', 'ja', 'ko', 'pt', 'ru', 'vi']);

    const draft = fake.getProductDraft('p1');
    assert.ok(draft, '译文应当写进草稿');
    assert.equal(draft.translations.en.name, 'en|特塑钩子');
    assert.equal(draft.translations.ar.name, 'ar|特塑钩子');

    // 草稿隔离：线上内容一个字节都没变
    assert.equal(fake.getProductTranslation('p1', 'en'), undefined);

    // 十个语言全部成功
    assert.equal(result.locales.filter((item) => item.outcome === 'synced').length, 10);
  });

  test('没有配置 Key 时逐语言报告失败，一个请求都不发', async () => {
    const fake = seedProduct();
    stubDeepSeek();

    const failed = await syncEntity(fake.db, { ...settings, apiKey: '' }, 'product', 'p1');
    assert.ok(failed);
    assert.equal(failed.ok, false);
    assert.equal(failed.error, 'not-configured');
    assert.equal(failed.requestCount, 0);
    assert.equal(calls.length, 0, '没配置 Key 时一个请求都不该发');
    assert.ok(failed.locales.every((item) => item.outcome === 'failed'));
  });
});

describe('只翻变化的部分', () => {
  test('中文没变化时零 API 调用', async () => {
    const fake = seedProduct();
    stubDeepSeek();

    await syncEntity(fake.db, settings, 'product', 'p1');
    calls = [];

    const second = await syncEntity(fake.db, settings, 'product', 'p1');
    assert.ok(second);
    assert.equal(second.nothingToDo, true);
    assert.equal(second.requestCount, 0);
    assert.equal(calls.length, 0, '重复同步不该产生任何请求');
  });

  test('只改中文的一个字段，就只翻那一个字段', async () => {
    const fake = seedProduct();
    stubDeepSeek();

    await syncEntity(fake.db, settings, 'product', 'p1');
    calls = [];

    fake.setProductTranslation('p1', 'zh', { name: '特塑钩子（新）' });
    const result = await syncEntity(fake.db, settings, 'product', 'p1');

    assert.ok(result);
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0].paths, ['translations.name'], '只该送出被改过的那一个字段');
    assert.equal(fake.getProductDraft('p1')?.translations.en.name, 'en|特塑钩子（新）');

    // 没改的字段不该被重新写一遍
    assert.deepEqual(
      result.locales.filter((item) => item.outcome === 'synced').map((item) => item.translated),
      Array(10).fill(1),
    );
  });

  test('中文内容哈希没变时，版本号不推进', async () => {
    const fake = seedProduct();
    stubDeepSeek();

    const first = await syncEntity(fake.db, settings, 'product', 'p1');
    const second = await syncEntity(fake.db, settings, 'product', 'p1');
    assert.equal(first?.revision, second?.revision, '内容没变就不该产生新版本');

    fake.setProductTranslation('p1', 'zh', { name: '改了' });
    const third = await syncEntity(fake.db, settings, 'product', 'p1');
    assert.equal(third?.revision, (first?.revision ?? 0) + 1);
  });
});

describe('中文清空', () => {
  test('中文清空的字段，译文跟着清空，且不产生 API 调用', async () => {
    const fake = seedProduct();
    stubDeepSeek();

    await syncEntity(fake.db, settings, 'product', 'p1');
    assert.equal(fake.getProductDraft('p1')?.translations.en.seoTitle, 'en|SEO 标题');

    calls = [];
    // 中文 SEO 标题被清空
    fake.setProductTranslation('p1', 'zh', { seoTitle: '' });

    const result = await syncEntity(fake.db, settings, 'product', 'p1');
    assert.ok(result);
    assert.equal(fake.getProductDraft('p1')?.translations.en.seoTitle, '', '中文删了，英文也该删');
    assert.equal(fake.getProductDraft('p1')?.translations.ar.seoTitle, '');

    // 清空是纯写库操作：请求里不该出现这个字段
    const paths = calls.flatMap((call) => call.paths);
    assert.equal(paths.includes('translations.seoTitle'), false, '清空不需要调用模型');
  });

  test('某个语言整条都是空的时候不建空翻译行', async () => {
    const fake = seedProduct();
    stubDeepSeek();
    await syncEntity(fake.db, settings, 'product', 'p1');

    fake.setProductTranslation('p1', 'zh', { name: '特塑钩子' });
    // 把这一语言的全部中文都清掉之后再同步
    for (const field of ['shortDescription', 'description', 'seoTitle'] as const) {
      fake.setProductTranslation('p1', 'zh', { [field]: '' });
    }
    const result = await syncEntity(fake.db, settings, 'product', 'p1');
    assert.ok(result);
  });
});

describe('结构与格式保持', () => {
  test('规格表单元格按「行 id + 列 id」回填，不是按数组下标', async () => {
    const fake = seedProduct();
    stubDeepSeek();

    await syncEntity(fake.db, settings, 'product', 'p1');

    const draft = fake.getProductDraft('p1');
    assert.ok(draft);
    assert.equal(draft.specTable.rows[0].cells.col_a.en, 'en|不锈钢');
    assert.equal(draft.specTable.rows[1].cells.col_b.en, 'en|30 mm');
    assert.equal(draft.specTable.columns[0].values.en, 'en|材质');
    assert.equal(draft.variantGroups[0].values.en, 'en|型号');
    assert.equal(draft.variantGroups[0].options[0].values.en, 'en|标准型');
  });

  test('新增一行不会打乱已有行的译文', async () => {
    const fake = seedProduct();
    stubDeepSeek();
    await syncEntity(fake.db, settings, 'product', 'p1');

    calls = [];
    // 在**前面**插一行：按下标回填的话，原来的 row_1 / row_2 会被覆盖成新行的译文
    const draft = fake.getProductDraft('p1');
    assert.ok(draft);
    draft.specTable.rows.unshift({
      id: 'row_0',
      cells: {
        col_a: { zh: '铜', en: '', vi: '', es: '', ja: '', ru: '', ar: '', fr: '', ko: '', pt: '', hi: '' },
        col_b: { zh: '10 mm', en: '', vi: '', es: '', ja: '', ru: '', ar: '', fr: '', ko: '', pt: '', hi: '' },
      },
    });
    await fake.db.product.update({
      where: { id: 'p1' },
      data: { draftData: draft as unknown as never },
    });

    await syncEntity(fake.db, settings, 'product', 'p1');

    const after = fake.getProductDraft('p1');
    assert.ok(after);
    assert.equal(after.specTable.rows[0].cells.col_a.en, 'en|铜', '新行拿到了自己的译文');
    assert.equal(after.specTable.rows[1].cells.col_a.en, 'en|不锈钢', '老行的译文没有被新行顶掉');
    assert.equal(after.specTable.rows[2].cells.col_b.en, 'en|30 mm');
    // 只翻了新行的那两个单元格
    assert.deepEqual(calls.flatMap((call) => call.paths).sort(), [
      'specTable.rows.row_0.cells.col_a',
      'specTable.rows.row_0.cells.col_b',
    ]);
  });

  test('HTML 片段被标记成 html，提示词里带上对应的保留规则', async () => {
    const fake = seedProduct();
    let sawPrompt = '';
    globalThis.fetch = (async (_url: string, init: { body: string }) => {
      const body = JSON.parse(init.body) as { messages: { content: string }[] };
      sawPrompt = body.messages[1].content;
      const call = parsePrompt(sawPrompt);
      calls.push(call);
      return {
        ok: true,
        status: 200,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  translations: { en: Object.fromEntries(call.paths.map((p) => [p, `en|${call.source[p]}`])) },
                }),
              },
            },
          ],
        }),
        text: async () => '',
      } as unknown as Response;
    }) as typeof fetch;

    await syncEntity(fake.db, settings, 'product', 'p1', { locales: ['en'] });
    assert.match(sawPrompt, /HTML/, '带标签的字段要提示模型保留标签');

    const draft = fake.getProductDraft('p1');
    assert.match(draft?.translations.en.description ?? '', /<p>/, 'HTML 标签必须原样保留');
    assert.match(draft?.translations.en.description ?? '', /\{占位符\}/, '占位符必须原样保留');
  });
});

describe('部分失败', () => {
  test('某些语言失败时，成功的语言照常保留', async () => {
    const fake = seedProduct();
    // 阿拉伯语与日语拿不到译文
    stubDeepSeek({ failLocales: ['ar', 'ja'] });

    const result = await syncEntity(fake.db, settings, 'product', 'p1');
    assert.ok(result);

    const ok = result.locales.filter((item) => item.outcome === 'synced').map((item) => item.locale);
    const bad = result.locales.filter((item) => item.outcome === 'failed').map((item) => item.locale);
    assert.deepEqual(bad.sort(), ['ar', 'ja']);
    assert.equal(ok.length, 8);

    const draft = fake.getProductDraft('p1');
    assert.equal(draft?.translations.en.name, 'en|特塑钩子', '成功的语言已经写好了');
    assert.equal(draft?.translations.ar.name, '', '失败的语言不该有半截内容');
    assert.equal(draft?.translations.ja.name, '');

    // 失败状态被记下来，供「只重试失败内容」使用
    assert.equal(fake.getState('product', 'p1', 'ar')?.status, 'FAILED');
    assert.equal(fake.getState('product', 'p1', 'en')?.status, 'SYNCED');
  });

  test('只重试失败的语言', async () => {
    const fake = seedProduct();
    stubDeepSeek({ failLocales: ['ar'] });
    await syncEntity(fake.db, settings, 'product', 'p1');

    calls = [];
    stubDeepSeek();
    const retry = await syncEntity(fake.db, settings, 'product', 'p1', { onlyFailed: true });

    assert.ok(retry);
    assert.equal(retry.locales.length, 1, '只有阿拉伯语需要重试');
    assert.equal(retry.locales[0].locale, 'ar');
    assert.deepEqual(calls[0].targets, ['ar'], '重试不该把已经成功的语言再翻一遍');
    assert.equal(fake.getProductDraft('p1')?.translations.ar.name, 'ar|特塑钩子');
  });
});

describe('同步计划', () => {
  test('计划里能看出每个语言还差多少个字段', async () => {
    const fake = seedProduct();
    stubDeepSeek();
    await syncEntity(fake.db, settings, 'product', 'p1');

    const plan = await planSync(fake.db, 'product', 'p1');
    assert.ok(plan);
    assert.equal(plan.changed, false);
    for (const summary of plan.locales) {
      assert.equal(summary.state, 'synced', `${summary.locale} 应当已同步`);
      assert.equal(summary.pendingCount, 0);
      assert.ok(summary.totalCount > 0, '应当有字段被统计');
    }
  });

  test('中文改一个字段后，只有那个字段计入待翻，且每个语言都是 partial', async () => {
    const fake = seedProduct();
    stubDeepSeek();
    await syncEntity(fake.db, settings, 'product', 'p1');

    fake.setProductTranslation('p1', 'zh', { name: '新名字' });
    const plan = await planSync(fake.db, 'product', 'p1');
    assert.ok(plan);
    assert.equal(plan.changed, true);
    assert.equal(plan.revision, plan.storedRevision + 1);

    for (const summary of plan.locales) {
      assert.equal(summary.pendingCount, 1);
      assert.equal(summary.state, 'partial', '只差一个字段 → 部分待同步');
      assert.deepEqual(
        (plan.pendingByLocale.get(summary.locale) ?? []).map((unit) => unit.path),
        ['translations.name'],
      );
    }
  });
});

describe('页面与首页', () => {
  test('页面区块的按钮文字会翻，按钮链接不会被翻', async () => {
    const fake = createFakePrisma({
      pages: [
        {
          id: 'home',
          slug: 'home',
          isHome: true,
          status: 'PUBLISHED',
          translations: { zh: { title: '首页', seoTitle: '首页 SEO', seoDescription: '描述' } },
          blocks: [
            {
              id: 'b_hero',
              key: 'hero',
              translations: {
                zh: {
                  title: '专业制造',
                  subtitle: '二十年经验',
                  body: '<p>正文</p>',
                  ctaLabel: '联系我们',
                  ctaHref: '/zh/contact',
                },
              },
            },
          ],
        },
      ],
    });
    stubDeepSeek();

    const result = await syncEntity(fake.db, settings, 'page', 'home');
    assert.ok(result);
    assert.equal(result.requestCount, 1);

    const draft = fake.getPageDraft('home');
    assert.ok(draft);
    assert.equal(draft.translations.en.title, 'en|首页');
    assert.equal(draft.blocks[0].values.en.title, 'en|专业制造');
    assert.equal(draft.blocks[0].values.en.ctaLabel, 'en|联系我们');

    // 链接是结构，不是文案：它**不该**出现在任何一次请求里。
    // 前台渲染时会由 withLocale / blockHref 补上当前语言前缀，缺这一格会回退到字典默认值。
    const paths = calls.flatMap((call) => call.paths);
    assert.equal(
      paths.some((path) => path.endsWith('ctaHref')),
      false,
      'ctaHref 不该出现在任何请求里',
    );
    assert.equal(
      draft.blocks[0].values.zh.ctaHref,
      '/zh/contact',
      '中文原文里的链接必须原样留着，不能被同步清掉',
    );
  });
});

describe('公司资料', () => {
  test('直接写库（公司资料没有草稿机制），并保留非中文语言的既有名称', async () => {
    const fake = createFakePrisma({
      company: { zh: { name: '米众新材料', tagline: '标语', address: '某某路 1 号' } },
    });
    stubDeepSeek();

    const result = await syncEntity(fake.db, settings, 'company', 'primary');
    assert.ok(result);
    assert.equal(result.locales.length, 10);
    assert.ok(result.locales.every((item) => item.outcome === 'synced'));
  });
});

describe('时间预算', () => {
  test('预算用尽时带着进度返回，剩下的语言标记为待处理而不是失败', async () => {
    const fake = seedProduct();
    stubDeepSeek();

    // 预算为负：第一批开始之前就已超时，等价于「这一批还没轮到就被叫停」
    const result = await syncEntity(fake.db, settings, 'product', 'p1', { budgetMs: -1 });
    assert.ok(result);
    assert.equal(result.hasMore, true, '应当告诉调用方「还没做完，再来一次」');
    assert.equal(result.requestCount, 0);
    assert.ok(
      result.locales.every((item) => item.outcome === 'pending'),
      '还没轮到的语言不该被标成失败',
    );
    assert.equal(
      fake.getState('product', 'p1', 'en')?.status,
      'TRANSLATING',
      '应当留下「正在翻译」的痕迹，界面据此显示进行中',
    );

    // 再推进一次就完成了
    calls = [];
    const next = await syncEntity(fake.db, settings, 'product', 'p1');
    assert.ok(next);
    assert.equal(next.hasMore, false);
    assert.equal(next.locales.filter((item) => item.outcome === 'synced').length, 10);
  });

  test('内容大到需要多个批次时，中途停下不会把整条内容算作完成', async () => {
    // 造 60 行规格 → 远超单批 6000 字符上限，必然切成多批
    const rows = Array.from({ length: 60 }, (_, index) => ({
      id: `row_${index}`,
      cells: {
        col_a: { ...wideValues, zh: `材质${index}：${'填'.repeat(200)}` },
        col_b: { ...wideValues, zh: `宽度${index}mm` },
      },
    }));
    const fake = createFakePrisma({
      products: [
        {
          id: 'big',
          slug: 'big',
          translations: { zh: { name: '大商品' } },
          specTable: {
            columns: [
              { id: 'col_a', values: { ...wideValues, zh: '材质' } },
              { id: 'col_b', values: { ...wideValues, zh: '宽度' } },
            ],
            rows,
          },
        },
      ],
    });
    stubDeepSeek();

    const partial = await syncEntity(fake.db, settings, 'product', 'big', { budgetMs: 0 });
    assert.ok(partial);
    assert.equal(partial.hasMore, true, '批次没跑完就该如实上报');
    assert.ok(partial.requestCount >= 1, '至少跑完了一批');

    const rest = await syncEntity(fake.db, settings, 'product', 'big', { budgetMs: 120_000 });
    assert.ok(rest);
    assert.equal(rest.hasMore, false, '第二轮应当全部做完');

    const draft = fake.getProductDraft('big');
    assert.equal(draft?.specTable.rows[59].cells.col_a.en, `en|材质59：${'填'.repeat(200)}`);
  });
});

describe('多语言全空的中文内容', () => {
  test('中文什么都没有时不产生任何请求', async () => {
    const fake = createFakePrisma({ products: [{ id: 'empty', slug: 'empty', translations: {} }] });
    stubDeepSeek();

    const result = await syncEntity(fake.db, settings, 'product', 'empty');
    assert.ok(result);
    assert.equal(result.nothingToDo, true);
    assert.equal(result.requestCount, 0);
    assert.equal(calls.length, 0);
  });
});

describe('资源不存在', () => {
  test('未知内容类型返回 null 而不是抛错', async () => {
    const fake = createFakePrisma();
    const result = await syncEntity(fake.db, settings, 'not-a-type', 'x');
    assert.equal(result, null);
  });

  test('未知语言之外的内容实体返回 null', async () => {
    const fake = createFakePrisma();
    const result = await syncEntity(fake.db, settings, 'product', 'missing');
    assert.equal(result, null);
  });
});

/** 类型上确认 targetLocales 与统一清单一致（加语言时这里会跟着变） */
const nonChinese: Locale[] = locales.filter((locale) => locale !== 'zh');
test('目标语言清单来自统一语言定义', () => {
  assert.equal(nonChinese.length, 10);
});
