import { test, describe, afterEach, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { locales } from '@/lib/i18n/config';
import type { TranslationSettings } from '@/lib/translation/settings';
import {
  advanceJob,
  collectScope,
  createJob,
  createRetryJob,
  getJobProgress,
  syncForPublish,
} from '@/lib/translation/jobs';
import { createFakePrisma } from './fake-db';

/**
 * 长任务与「发布自带同步保险」的行为测试。
 *
 * 这几条是需求里最核心的产品体验，也是最容易实现成「看起来对、其实每次都重翻」
 * 或者「失败了还说发布成功」的地方：
 *   - 没有待同步字段时一个请求都不发（反复点发布不该反复花钱）；
 *   - 目标语言失败就**放弃发布**，线上保持原样；
 *   - 重复点发布命中同一个任务，不会翻两遍；
 *   - 中途断开可以接着做，而不是从头来。
 */

const settings: TranslationSettings = {
  apiKey: 'sk-test-not-a-real-key',
  baseUrl: 'https://api.test/v1',
  model: 'deepseek-chat',
  source: 'database',
  keyStorage: 'encrypted',
};

const originalFetch = globalThis.fetch;
let calls: { paths: string[]; targets: string[] }[] = [];

function stubDeepSeek(options: { failLocales?: string[] } = {}) {
  globalThis.fetch = (async (_url: string, init: { body: string }) => {
    const body = JSON.parse(init.body) as { messages: { content: string }[] };
    const userPrompt = body.messages[1].content;
    const targets = [...userPrompt.matchAll(/^- ([a-z]{2}): /gm)].map((match) => match[1]);
    const { source } = JSON.parse(
      userPrompt.slice(userPrompt.lastIndexOf('原文：') + '原文：'.length),
    ) as { source: Record<string, string> };
    calls.push({ paths: Object.keys(source), targets });

    const translations: Record<string, Record<string, string>> = {};
    for (const locale of locales) {
      if (locale === 'zh' || options.failLocales?.includes(locale)) continue;
      translations[locale] = Object.fromEntries(
        Object.entries(source).map(([path, text]) => [path, `${locale}|${text}`]),
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

function seed() {
  return createFakePrisma({
    products: [
      { id: 'p1', slug: 'tehsugouzi', translations: { zh: { name: '特塑钩子', description: '正文' } } },
      { id: 'p2', slug: 'manli', translations: { zh: { name: '满力', description: '正文' } } },
    ],
    pages: [
      {
        id: 'home',
        slug: 'home',
        isHome: true,
        status: 'PUBLISHED',
        translations: { zh: { title: '首页' } },
      },
    ],
    company: { zh: { name: '米众新材料' } },
  });
}

beforeEach(() => {
  calls = [];
  stubDeepSeek();
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('发布自带的同步保险', () => {
  test('已经全部同步时：不建任务、不发请求', async () => {
    const fake = seed();
    await syncForPublish(fake.db, settings, 'product', 'p1');
    assert.ok(calls.length > 0, '第一次应当真的翻了');
    calls = [];

    const again = await syncForPublish(fake.db, settings, 'product', 'p1');
    assert.equal(again.status, 'ready');
    assert.equal(again.jobId, null, '什么都不用做时不该建任务');
    assert.equal(calls.length, 0, '反复点发布不该反复花钱');
  });

  test('中文改过之后：发布会自动补齐全部语言', async () => {
    const fake = seed();
    await syncForPublish(fake.db, settings, 'product', 'p1');

    fake.setProductTranslation('p1', 'zh', { name: '特塑钩子（改）' });
    calls = [];

    const result = await syncForPublish(fake.db, settings, 'product', 'p1');
    assert.equal(result.status, 'ready');
    assert.deepEqual(calls.flatMap((call) => call.paths), ['translations.name'], '只翻改过的那一个字段');
    assert.equal(fake.getProductDraft('p1')?.translations.en.name, 'en|特塑钩子（改）');
  });

  test('目标语言失败时返回 failed —— 调用方据此放弃本次发布', async () => {
    const fake = seed();
    stubDeepSeek({ failLocales: ['ar', 'ja'] });

    const result = await syncForPublish(fake.db, settings, 'product', 'p1');
    assert.equal(result.status, 'failed');
    assert.equal(result.progress?.failedItems, 2);
    assert.deepEqual(
      result.progress?.failures.map((item) => item.locale).sort(),
      ['ar', 'ja'],
    );

    // 成功的那些语言已经写进草稿（发布失败但工作没白做），失败的语言保持为空
    assert.equal(fake.getProductDraft('p1')?.translations.en.name, 'en|特塑钩子');
    assert.equal(fake.getProductDraft('p1')?.translations.ar.name, '');
  });

  test('没有配置 Key 且确实需要翻译时，发布同步失败且一个请求都不发', async () => {
    const fake = seed();
    const result = await syncForPublish(fake.db, { ...settings, apiKey: '' }, 'product', 'p1');
    assert.equal(result.status, 'failed');
    assert.equal(calls.length, 0);
  });

  test('没有配置 Key、但本来就不需要翻译时，发布照常放行', async () => {
    const fake = seed();
    // 先把内容同步好（用可用的 Key）
    await syncForPublish(fake.db, settings, 'product', 'p1');
    calls = [];

    // 模拟之后 Key 被撤掉：已同步的内容不该因为「没 Key」而发布不了
    const result = await syncForPublish(fake.db, { ...settings, apiKey: '' }, 'product', 'p1');
    assert.equal(result.status, 'ready');
    assert.equal(calls.length, 0);
  });
});

describe('幂等', () => {
  test('同一次中文版本的重复发布命中同一个任务，不会翻两遍', async () => {
    const fake = seed();
    // 先制造一个「部分失败」的任务，让它停在未完成状态
    stubDeepSeek({ failLocales: ['ar'] });
    const first = await syncForPublish(fake.db, settings, 'product', 'p1');
    assert.equal(first.status, 'failed');
    const firstJobId = first.jobId;
    assert.ok(firstJobId);

    const requestsAfterFirst = calls.length;

    // 再点一次：应当复用同一个任务（并重试失败的语言），而不是新建一个翻两遍
    stubDeepSeek();
    calls = [];
    const second = await syncForPublish(fake.db, settings, 'product', 'p1');
    assert.equal(second.jobId, firstJobId, '幂等键应当命中同一个任务');
    assert.deepEqual(calls.flatMap((call) => call.targets), ['ar'], '只重试失败的那一种语言');
    assert.equal(second.status, 'ready');
    assert.ok(requestsAfterFirst > 0);
  });

  test('中文版本变化后，幂等键跟着变 —— 是一个新任务', async () => {
    const fake = seed();
    const first = await syncForPublish(fake.db, settings, 'product', 'p1');

    fake.setProductTranslation('p1', 'zh', { name: '改了' });
    const second = await syncForPublish(fake.db, settings, 'product', 'p1');

    assert.notEqual(second.jobId, first.jobId);
    assert.equal(second.revision, first.revision + 1);
  });

  test('已经有同类任务在跑时，全站同步复用它而不是并行开第二个', async () => {
    const fake = seed();
    const targets = await collectScope(fake.db);
    const first = await createJob(fake.db, { kind: 'SYNC_ALL', targets });
    const second = await createJob(fake.db, { kind: 'SYNC_ALL', targets });
    assert.equal(second.jobId, first.jobId);
    assert.equal(second.created, false);
  });
});

describe('全站同步', () => {
  test('盘点范围覆盖全部已发布的中文内容，且不含未发布的', async () => {
    const fake = createFakePrisma({
      products: [
        { id: 'published', slug: 'a', published: true, translations: { zh: { name: '已发布' } } },
        { id: 'draft', slug: 'b', published: false, translations: { zh: { name: '草稿' } } },
      ],
      pages: [
        { id: 'live', slug: 'live', status: 'PUBLISHED', translations: { zh: { title: '已发布页' } } },
        { id: 'draftpage', slug: 'dp', status: 'DRAFT', translations: { zh: { title: '草稿页' } } },
      ],
      company: { zh: { name: '公司' } },
    });

    const targets = await collectScope(fake.db);
    const ids = targets.map((target) => target.entityId);
    assert.ok(ids.includes('published'));
    assert.ok(!ids.includes('draft'), '未发布的商品不该进全站同步范围');
    assert.ok(ids.includes('live'));
    assert.ok(!ids.includes('draftpage'), '未发布的页面不该进全站同步范围');
    assert.ok(ids.includes('primary'), '公司资料是单例，始终在范围内');
  });

  test('一次推进把每条内容 × 每种语言都做完，并逐项记录状态', async () => {
    const fake = seed();
    const targets = await collectScope(fake.db);
    const { jobId, totalItems } = await createJob(fake.db, { kind: 'SYNC_ALL', targets });

    // 三条内容 × 十种语言
    assert.equal(totalItems, targets.length * (locales.length - 1));

    const advanced = await advanceJob(fake.db, settings, jobId, { budgetMs: 120_000 });
    assert.ok(advanced);
    assert.equal(advanced.hasMore, false);
    assert.equal(advanced.progress.status, 'SUCCEEDED');
    assert.equal(advanced.progress.failedItems, 0);
    assert.equal(advanced.progress.completedItems, totalItems);
    assert.equal(advanced.progress.pendingItems, 0);
  });

  test('中途停下的任务，再推进一次接着做而不是从头来', async () => {
    const fake = seed();
    const targets = await collectScope(fake.db);
    const { jobId } = await createJob(fake.db, { kind: 'SYNC_ALL', targets });

    // 预算为负：一条都没轮到
    const stopped = await advanceJob(fake.db, settings, jobId, { budgetMs: -1 });
    assert.ok(stopped);
    assert.equal(stopped.hasMore, true);
    assert.ok((stopped.progress.pendingItems ?? 0) > 0);

    const requestsBefore = calls.length;

    const finished = await advanceJob(fake.db, settings, jobId, { budgetMs: 120_000 });
    assert.ok(finished);
    assert.equal(finished.hasMore, false);
    assert.equal(finished.progress.pendingItems, 0);
    assert.ok(calls.length > requestsBefore);
  });

  test('内容被删掉后，任务跳过它而不是卡死', async () => {
    const fake = seed();
    const targets = await collectScope(fake.db);
    const { jobId } = await createJob(fake.db, {
      kind: 'SYNC_ALL',
      targets: [...targets, { entityType: 'product', entityId: 'gone', label: '不存在' }],
    });

    const advanced = await advanceJob(fake.db, settings, jobId, { budgetMs: 120_000 });
    assert.ok(advanced);
    assert.equal(advanced.hasMore, false, '不存在的内容应当被跳过，而不是让任务永远跑不完');
    assert.equal(advanced.progress.status, 'SUCCEEDED');
  });
});

describe('只重试失败内容', () => {
  test('失败项被单独挑出来重试，成功的不重翻', async () => {
    const fake = seed();
    stubDeepSeek({ failLocales: ['ar'] });

    const targets = await collectScope(fake.db);
    const { jobId } = await createJob(fake.db, { kind: 'SYNC_ALL', targets });
    const first = await advanceJob(fake.db, settings, jobId, { budgetMs: 120_000 });
    assert.ok(first);
    assert.ok(first.progress.failedItems > 0);
    assert.equal(first.progress.status, 'PARTIAL');

    stubDeepSeek();
    calls = [];
    const retry = await createRetryJob(fake.db, jobId);
    assert.ok(retry);
    assert.equal(retry.totalItems, first.progress.failedItems, '只应重试失败的那些工作项');

    const done = await advanceJob(fake.db, settings, retry.jobId, { budgetMs: 120_000 });
    assert.ok(done);
    assert.equal(done.progress.status, 'SUCCEEDED');
    assert.deepEqual([...new Set(calls.flatMap((call) => call.targets))], ['ar']);
  });

  test('没有失败项时返回 null，不会凭空建一个空任务', async () => {
    const fake = seed();
    const targets = await collectScope(fake.db);
    const { jobId } = await createJob(fake.db, { kind: 'SYNC_ALL', targets });
    await advanceJob(fake.db, settings, jobId, { budgetMs: 120_000 });

    assert.equal(await createRetryJob(fake.db, jobId), null);
  });
});

describe('进度读取', () => {
  test('进度里能看出总数、完成数、失败数与失败明细', async () => {
    const fake = seed();
    stubDeepSeek({ failLocales: ['ar'] });
    const targets = await collectScope(fake.db);
    const { jobId } = await createJob(fake.db, { kind: 'SYNC_ALL', targets });
    await advanceJob(fake.db, settings, jobId, { budgetMs: 120_000 });

    const progress = await getJobProgress(fake.db, jobId);
    assert.ok(progress.totalItems > 0);
    assert.equal(progress.pendingItems, 0);
    assert.equal(progress.completedItems + progress.failedItems, progress.totalItems);
    assert.equal(progress.failures.length, progress.failedItems);
    assert.ok(progress.requestCount > 0);
    assert.ok(progress.tokenEstimate > 0, 'token 估算应当有值');
  });
});
