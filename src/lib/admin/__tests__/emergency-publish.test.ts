import { test, describe, afterEach, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { locales } from '@/lib/i18n/config';
import { localesWithContent, strictLocaleFallbackEnabled } from '@/lib/catalog';
import type { TranslationSettings } from '@/lib/translation/settings';
import { planSync, markExplicitlyStale, type LocaleSyncSummary } from '@/lib/translation/state';
import { advanceJob, createJob, getJobProgress, type JobProgress } from '@/lib/translation/jobs';
import { loadProductDraftState, saveDraft } from '@/lib/admin/product-draft-store';
import { syncEntity } from '@/lib/translation/engine';
import { finishProductPublish } from '@/lib/admin/finish-publish';
import {
  buildEmergencyAuditDetail,
  classifyPublishFailure,
  localeCoverage,
  performEmergencyPublish,
} from '@/lib/admin/emergency-publish';
import { createFakePrisma } from '@/lib/translation/__tests__/fake-db';

/**
 * 应急发布的测试。
 *
 * 这个功能的全部价值在于**边界**：什么时候能出现、出现之后做了什么、
 * 以及绝不能做什么（伪造同步状态、清空已有译文、让旧任务把旧译文写回来）。
 * 所以下面每条断言都对着需求里的一句话，而不是对着实现细节。
 */

const settings: TranslationSettings = {
  apiKey: 'sk-test-not-a-real-key',
  baseUrl: 'https://api.test/v1',
  model: 'deepseek-chat',
  source: 'database',
  keyStorage: 'encrypted',
};

const originalFetch = globalThis.fetch;
const originalStrict = process.env.STRICT_LOCALE_FALLBACK;
let calls: { paths: string[]; targets: string[] }[] = [];

function stubDeepSeek() {
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
      if (locale === 'zh') continue;
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

beforeEach(() => {
  calls = [];
  stubDeepSeek();
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalStrict === undefined) delete process.env.STRICT_LOCALE_FALLBACK;
  else process.env.STRICT_LOCALE_FALLBACK = originalStrict;
});

/**
 * 造一份「发布同步失败」的进度。
 *
 * 参数收成 `errors: string[]` 而不是完整的 failures 数组：用例关心的只是
 * 「哪几类失败」，其余的字段（内容 id、语言）与判定无关，写全了反而看不清重点。
 */
function progress(
  input: { errors?: string[] } & Partial<Pick<JobProgress, 'pendingItems' | 'failedItems' | 'lastError'>> = {},
): JobProgress {
  const errors = input.errors ?? [];
  return {
    id: 'job_1',
    kind: 'PUBLISH',
    status: 'FAILED',
    totalItems: 3,
    completedItems: 2,
    failedItems: input.failedItems ?? (errors.length > 0 ? errors.length : 0),
    pendingItems: input.pendingItems ?? 0,
    requestCount: 1,
    tokenEstimate: 100,
    startedAt: null,
    finishedAt: null,
    lastError: input.lastError ?? null,
    failures: errors.map((error, index) => ({
      entityType: 'product',
      entityId: 'p1',
      label: null,
      locale: index === 0 ? 'ar' : 'ja',
      error,
    })),
  } as JobProgress;
}

/** 一个已经发布、有中文与英文内容的商品 */
function seeded() {
  return createFakePrisma({
    products: [
      {
        id: 'p1',
        slug: 'manli',
        translations: {
          zh: { name: '满力', description: '中文正文' },
          en: { name: 'Manli', description: 'English body' },
        },
      },
    ],
  });
}

describe('1. 翻译服务故障时出现应急发布', () => {
  test('超时', () => {
    const offer = classifyPublishFailure(progress({ errors: ['timeout'] }));
    assert.equal(offer.eligible, true);
    assert.equal(offer.failureKind, 'timeout');
  });

  test('网络错误 / 429 / 5xx 同样可以', () => {
    for (const kind of ['network', 'rate-limit', 'server'] as const) {
      const offer = classifyPublishFailure(progress({ errors: [kind] }));
      assert.equal(offer.eligible, true, `${kind} 应当可以应急`);
      assert.equal(offer.failureKind, kind);
    }
  });

  test('多种暂时性故障混在一起时取主要的那一种', () => {
    const offer = classifyPublishFailure(
      progress({ errors: ['timeout', 'timeout', 'server'] }),
    );
    assert.equal(offer.eligible, true);
    assert.equal(offer.failureKind, 'timeout');
  });

  test('同步还在进行中时不算故障', () => {
    const offer = classifyPublishFailure(progress({ pendingItems: 2, failedItems: 0 }));
    assert.equal(offer.eligible, false);
    assert.equal(offer.reason, 'none-needed');
  });
});

describe('2. 非服务故障一律不能用应急发布绕过', () => {
  test('返回结构不对（数据结构错误）', () => {
    const offer = classifyPublishFailure(progress({ errors: ['bad-response'] }));
    assert.equal(offer.eligible, false);
    assert.equal(offer.reason, 'content');
  });

  test('模型漏翻了字段', () => {
    const offer = classifyPublishFailure(progress({ errors: ['incomplete'] }));
    assert.equal(offer.eligible, false);
    assert.equal(offer.reason, 'content');
  });

  test('没配 Key / Key 被拒 —— 是配置问题，修它只要十秒', () => {
    for (const kind of ['not-configured', 'auth'] as const) {
      const offer = classifyPublishFailure(progress({ errors: [kind] }));
      assert.equal(offer.eligible, false, `${kind} 不该能应急`);
      assert.equal(offer.reason, 'config');
    }
  });

  test('暂时性故障里混进一个结构错误 → 整体不可应急', () => {
    // 掺进非服务故障就说明问题不只在可用性上；此时放行会把问题
    // 掩盖成一个「看起来发布成功」的版本
    const offer = classifyPublishFailure(
      progress({ errors: ['timeout', 'bad-response'] }),
    );
    assert.equal(offer.eligible, false);
    assert.equal(offer.reason, 'content');
  });

  test('中文在同步过程中被改过 → 是内容一致性问题，不是服务故障', () => {
    const offer = classifyPublishFailure(
      progress({ errors: ['timeout'], lastError: 'source-changed' }),
    );
    assert.equal(offer.eligible, false);
    assert.equal(offer.reason, 'content');
  });

  test('没有失败明细时不敢归因，也不放行', () => {
    const offer = classifyPublishFailure(progress({ errors: [] }));
    assert.equal(offer.eligible, false);
  });

  test('拿不到进度时不放行', () => {
    assert.equal(classifyPublishFailure(null).eligible, false);
    assert.equal(classifyPublishFailure(undefined).eligible, false);
  });
});

describe('3 & 4. 只发布中文，已有的外语沿用上一版', () => {
  async function emergencyPublish(fake: ReturnType<typeof createFakePrisma>) {
    const state = await loadProductDraftState(fake.db, 'p1');
    assert.ok(state);

    // 管理员改了中文（草稿里英文还是旧的那一份）
    const draft = state.draft;
    draft.translations.zh.name = '满力（改）';

    const coverage = await localeCoverage(fake.db, 'product', 'p1');
    await markExplicitlyStale(fake.db, {
      entityType: 'product',
      entityId: 'p1',
      locales: [...coverage.staleLocales, ...coverage.missingLocales],
    });

    const releaseId = await finishProductPublish(fake.db, 'p1', draft, {
      userId: 'u1',
      revision: 2,
      jobId: null,
      kind: 'EMERGENCY',
      reason: 'DeepSeek 一直超时，价格改动不能再等',
      failureKind: 'timeout',
      staleLocales: coverage.staleLocales,
      missingLocales: coverage.missingLocales,
    });

    return { releaseId, coverage };
  }

  test('中文上线了，英文仍然是上一版而不是被清空', async () => {
    const fake = seeded();
    await emergencyPublish(fake);

    assert.equal(fake.getProductTranslation('p1', 'zh')?.name, '满力（改）', '中文应当更新');
    assert.equal(
      fake.getProductTranslation('p1', 'en')?.name,
      'Manli',
      '已有外语必须原样保留，不能被清空',
    );
    assert.equal(fake.getProductTranslation('p1', 'en')?.description, 'English body');
  });

  test('完全没有译文的语言不会被凭空造出一行', async () => {
    const fake = seeded();
    await emergencyPublish(fake);

    for (const locale of ['ar', 'ja', 'vi'] as const) {
      assert.equal(
        fake.getProductTranslation('p1', locale),
        undefined,
        `${locale} 没有任何译文，不该被造出来`,
      );
    }
  });

  test('发布记录如实写明这是应急发布、原因是翻译服务故障、只有中文上线', async () => {
    const fake = seeded();
    const { releaseId } = await emergencyPublish(fake);

    const [release] = fake.getReleases('product', 'p1');
    assert.equal(release.id, releaseId);
    assert.equal(release.kind, 'EMERGENCY');
    assert.deepEqual(release.locales, ['zh']);
    assert.equal(release.failureKind, 'timeout');
    assert.match(String(release.reason), /超时/);
  });

  test('发布记录里列出哪些语言停在旧版、哪些完全没有', async () => {
    const fake = seeded();
    const { coverage } = await emergencyPublish(fake);

    assert.deepEqual(coverage.staleLocales, ['en']);
    assert.equal(coverage.missingLocales.length, 9);
    assert.equal(coverage.missingLocales.includes('ar'), true);
  });
});

describe('6. 外语被正确标记为待同步', () => {
  test('应急发布后，全部外语都显示为待同步而不是「已是最新」', async () => {
    const fake = seeded();

    // 先跑一次正常同步，让英文有哈希记录 —— 模拟「翻译服务本来好好的」
    const before = await planSync(fake.db, 'product', 'p1');
    assert.ok(before);
    // 英文已有内容、没有记录 → 被认下来，显示已同步（这是刻意的规则）
    assert.equal(before.locales.find((item) => item.locale === 'en')?.state, 'synced');

    // 中文改了，然后翻译服务挂了 → 应急发布
    const state = await loadProductDraftState(fake.db, 'p1');
    assert.ok(state);
    const draft = state.draft;
    draft.translations.zh.name = '满力（应急改）';

    await markExplicitlyStale(fake.db, {
      entityType: 'product',
      entityId: 'p1',
      locales: ['en', 'ar', 'ja'],
    });

    const after = await planSync(fake.db, 'product', 'p1');
    assert.ok(after);

    for (const locale of ['en', 'ar', 'ja'] as const) {
      const summary: LocaleSyncSummary | undefined = after.locales.find((item) => item.locale === locale);
      assert.equal(summary?.state, 'stale', `${locale} 应当被标记为待同步`);
    }

    // 标记是"整条重翻"：即使英文有内容、看着像最新的，也要重来
    const pendingPaths = (after.pendingByLocale.get('en') ?? []).map((unit) => unit.path);
    assert.ok(pendingPaths.includes('translations.name'));
  });

  test('没有伪造任何哈希 —— 被标记的语言在 fields 里不留记录', async () => {
    const fake = seeded();
    await markExplicitlyStale(fake.db, {
      entityType: 'product',
      entityId: 'p1',
      locales: ['en'],
    });

    const state = fake.getState('product', 'p1', 'en');
    assert.equal(state?.status, 'STALE');
    // 不写哈希就等于不声称这些译文来自当前中文 —— 这是需求禁止伪造 sourceHash 的落点
    assert.equal(Object.keys((state?.fields as object | undefined) ?? {}).length, 0);

    // 顺手确认版本号也没被推进
    assert.equal(fake.getRevision('product', 'p1')?.revision, 1, '没有翻译发生，版本号不该动');
  });
});

describe('7. 翻译服务恢复后自动补齐', () => {
  test('补齐任务跑完后自动发布一次「语言补齐版本」', async () => {
    const fake = seeded();
    await markExplicitlyStale(fake.db, { entityType: 'product', entityId: 'p1', locales: ['en', 'ar'] });

    const plan = await planSync(fake.db, 'product', 'p1');
    assert.ok(plan);

    const { jobId } = await createJob(fake.db, {
      kind: 'EMERGENCY_SYNC',
      targets: [{ entityType: 'product', entityId: 'p1', label: '满力' }],
      sourceHash: plan.hash,
      idempotencyKey: 'emergency:product:p1:test',
      userId: 'u1',
    });

    const advanced = await advanceJob(fake.db, settings, jobId, { budgetMs: 120_000 });
    assert.ok(advanced);
    assert.equal(advanced.progress.status, 'SUCCEEDED');

    const releases = fake.getReleases('product', 'p1');
    assert.equal(releases.length, 1, '应当自动产生一条完整的发布记录');
    assert.equal(releases[0].kind, 'FULL');
    assert.equal(releases[0].locales.length, locales.length, '完整发布应包含全部语言');

    // 译文写进了线上，而不是停在草稿里
    assert.equal(fake.getProductTranslation('p1', 'ar')?.name, 'ar|满力');
    assert.equal(fake.getProductDraft('p1'), null, '自动发布之后草稿应当被清掉');
  });
});

describe('8. 中文再次修改后，旧任务不能把旧译文写回来', () => {
  test('来源哈希对不上时整批作废，一个字段都不写', async () => {
    const fake = seeded();
    await markExplicitlyStale(fake.db, { entityType: 'product', entityId: 'p1', locales: ['ar'] });

    const plan = await planSync(fake.db, 'product', 'p1');
    assert.ok(plan);

    // 任务钉在这一版中文上
    const { jobId } = await createJob(fake.db, {
      kind: 'EMERGENCY_SYNC',
      targets: [{ entityType: 'product', entityId: 'p1', label: '满力' }],
      sourceHash: plan.hash,
      idempotencyKey: 'emergency:product:p1:stale',
      userId: 'u1',
    });

    // 管理员又改了一次中文
    fake.setProductTranslation('p1', 'zh', { name: '满力（又改了）' });
    calls = [];

    const advanced = await advanceJob(fake.db, settings, jobId, { budgetMs: 120_000 });
    assert.ok(advanced);

    assert.equal(calls.length, 0, '中文变了就一个请求都不该发');
    assert.equal(advanced.progress.status, 'FAILED');
    assert.equal(advanced.progress.lastError, 'source-changed');
    assert.ok(advanced.progress.failures.every((item) => item.error === 'source-changed'));

    // 线上内容没有被旧译文覆盖
    assert.equal(fake.getProductTranslation('p1', 'ar'), undefined, '旧译文绝不能写回来');
  });

  test('作废之后草稿也保持干净', async () => {
    const fake = seeded();
    await markExplicitlyStale(fake.db, { entityType: 'product', entityId: 'p1', locales: ['ar'] });
    const plan = await planSync(fake.db, 'product', 'p1');
    assert.ok(plan);

    const { jobId } = await createJob(fake.db, {
      kind: 'EMERGENCY_SYNC',
      targets: [{ entityType: 'product', entityId: 'p1', label: '满力' }],
      sourceHash: plan.hash,
      userId: 'u1',
    });

    fake.setProductTranslation('p1', 'zh', { name: '又改了' });
    await advanceJob(fake.db, settings, jobId, { budgetMs: 120_000 });

    assert.equal(fake.getProductDraft('p1'), null, '作废的任务不该留下半份草稿');
  });
});

describe('9. 重复点击不会产生重复版本', () => {
  test('同一个幂等键只会建一个任务', async () => {
    const fake = seeded();
    const plan = await planSync(fake.db, 'product', 'p1');
    assert.ok(plan);

    const first = await createJob(fake.db, {
      kind: 'EMERGENCY_SYNC',
      targets: [{ entityType: 'product', entityId: 'p1', label: '满力' }],
      sourceHash: plan.hash,
      idempotencyKey: `emergency:product:p1:${plan.hash}`,
      userId: 'u1',
    });
    const second = await createJob(fake.db, {
      kind: 'EMERGENCY_SYNC',
      targets: [{ entityType: 'product', entityId: 'p1', label: '满力' }],
      sourceHash: plan.hash,
      idempotencyKey: `emergency:product:p1:${plan.hash}`,
      userId: 'u1',
    });

    assert.equal(second.jobId, first.jobId);
    assert.equal(second.created, false, '第二次点击不该排出第二个补齐任务');
  });

  test('补齐任务本身是幂等的：重复推进不会重复发布', async () => {
    const fake = seeded();
    await markExplicitlyStale(fake.db, { entityType: 'product', entityId: 'p1', locales: ['ar'] });
    const plan = await planSync(fake.db, 'product', 'p1');
    assert.ok(plan);

    const { jobId } = await createJob(fake.db, {
      kind: 'EMERGENCY_SYNC',
      targets: [{ entityType: 'product', entityId: 'p1', label: '满力' }],
      sourceHash: plan.hash,
      idempotencyKey: 'emergency:product:p1:idem',
      userId: 'u1',
    });

    await advanceJob(fake.db, settings, jobId, { budgetMs: 120_000 });
    await advanceJob(fake.db, settings, jobId, { budgetMs: 120_000 });
    await advanceJob(fake.db, settings, jobId, { budgetMs: 120_000 });

    assert.equal(fake.getReleases('product', 'p1').length, 1, '重复推进只该有一条发布记录');
    const progress = await getJobProgress(fake.db, jobId);
    assert.equal(progress.status, 'SUCCEEDED');
  });
});

describe('5. 没有译文的语言不进 hreflang 与 sitemap', () => {
  test('应急发布后仍然只有中文内容时，hreflang/sitemap 只列中文', () => {
    process.env.STRICT_LOCALE_FALLBACK = 'true';
    assert.equal(strictLocaleFallbackEnabled(), true);

    const rows = [{ locale: 'zh' as never, name: '满力' }];
    assert.deepEqual(localesWithContent(rows, locales), ['zh']);
  });

  test('有自己译文的语言才列出来', () => {
    process.env.STRICT_LOCALE_FALLBACK = 'true';
    const rows = [
      { locale: 'zh' as never, name: '满力' },
      { locale: 'en' as never, name: 'Manli' },
    ];
    assert.deepEqual(localesWithContent(rows, locales), ['zh', 'en']);
  });
});

describe('10. 非管理员不能执行', () => {
  test('应急与重试的每个 Server Action 都校验管理员会话', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/lib/admin/actions/emergency.ts'),
      'utf8',
    );
    assert.ok(source.startsWith("'use server'"));

    const chunks = source.split(/\nexport async function\s+/).slice(1);
    assert.ok(chunks.length >= 2, `只找到 ${chunks.length} 个 action，扫描逻辑可能失效了`);

    for (const chunk of chunks) {
      const name = chunk.slice(0, chunk.indexOf('(')).trim();
      assert.match(chunk, /requireAdminOrError/, `${name} 没有校验管理员会话`);
    }
  });
});

describe('11. 审计日志不含 API Key，也不含完整译文', () => {
  const detail = buildEmergencyAuditDetail({
    releaseId: 'rel_1',
    reason: 'DeepSeek 超时',
    failureKind: 'timeout',
    revision: 7,
    staleLocales: ['en'],
    missingLocales: ['ar', 'ja'],
  });

  test('只记元数据，字段名是固定的这几个', () => {
    assert.deepEqual(Object.keys(detail).sort(), [
      'failureKind',
      'kind',
      'missingLocales',
      'reason',
      'releaseId',
      'sourceRevision',
      'staleLocales',
    ]);
  });

  test('没有 Key、没有原文、没有译文', () => {
    const serialized = JSON.stringify(detail);
    assert.equal(/sk-|apiKey|Authorization|Bearer/i.test(serialized), false, '不该出现任何密钥痕迹');
    // 明细里的值只有 id、原因、语言代码与版本号，没有任何内容字段
    assert.equal(detail.kind, 'EMERGENCY');
    assert.equal(detail.sourceRevision, 7);
    assert.deepEqual(detail.staleLocales, ['en']);
    assert.deepEqual(detail.missingLocales, ['ar', 'ja']);
  });

  test('应急动作自己不去读翻译设置里的 Key', () => {
    // 它需要 Key 来重试一次翻译，但那个 Key 只经由 loadTranslationSettings 在
    // 服务端内部使用；审计与返回值里都不该出现它
    const source = readFileSync(join(process.cwd(), 'src/lib/admin/actions/emergency.ts'), 'utf8');
    assert.equal(/apiKey/.test(source), false, '应急动作不该直接碰 apiKey');
  });
});


describe('12. 版本语义：中文推进、外语不推进', () => {
  /**
   * 这一组是整件事的语义核心，值得把两个方向说清楚：
   *
   *   - 中文自己的 `ContentRevision` → **推进**（内容确实变了）；
   *   - 各语言的 `sourceRevision` 与来源哈希 → **不推进**（它们没有重新翻译过）。
   *
   * 只推进一半、或者两个都推进，都无法表达「这些译文落后于新版中文」。
   */
  async function editChinese(fake: ReturnType<typeof createFakePrisma>, name: string) {
    const state = await loadProductDraftState(fake.db, 'p1');
    assert.ok(state);
    const draft = state.draft;
    draft.translations.zh.name = name;
    await saveDraft(fake.db, 'p1', draft);
  }

  /** 一个只有中文的商品 —— 先正常同步一轮，让各语言都有一份「来自第 N 版中文」的记录 */
  function chineseOnly() {
    return createFakePrisma({
      products: [{ id: 'p1', slug: 'manli', translations: { zh: { name: '满力', description: '中文正文' } } }],
    });
  }

  test('应急发布前后，中文发布版本不同；外语的 translatedFromRevision 保持旧值', async () => {
    const fake = chineseOnly();

    // 先正常同步一次，让英文有一份「来自第 N 版中文」的记录
    const first = await syncEntity(fake.db, settings, 'product', 'p1');
    assert.ok(first);
    const revisionAfterSync = fake.getRevision('product', 'p1')?.revision ?? 0;
    const englishAfterSync = fake.getState('product', 'p1', 'en');
    assert.equal(englishAfterSync?.sourceRevision, revisionAfterSync, '英文此刻是最新的');

    // 管理员改中文，然后翻译服务挂了 → 应急发布
    await editChinese(fake, '满力（应急）');
    const plan = await planSync(fake.db, 'product', 'p1');
    assert.ok(plan);
    assert.equal(plan.changed, true);
    assert.equal(plan.revision, revisionAfterSync + 1, '中文产生了新版本');

    const coverage = await localeCoverage(fake.db, 'product', 'p1');
    await performEmergencyPublish(fake.db, {
      entityType: 'product',
      entityId: 'p1',
      reason: 'DeepSeek 超时',
      failureKind: 'timeout',
      revision: plan.revision,
      sourceHash: plan.hash,
      coverage,
      userId: 'u1',
    });

    // 1) 中文自己的版本号推进了
    const afterEmergency = fake.getRevision('product', 'p1')?.revision ?? 0;
    assert.equal(afterEmergency, revisionAfterSync + 1, '中文自身的 sourceRevision 必须推进');

    // 2) 发布记录记的就是这个新版本 —— 两者不能各说各话
    const [release] = fake.getReleases('product', 'p1');
    assert.equal(release.kind, 'EMERGENCY');
    assert.equal(release.revision, afterEmergency, 'release 与 ContentRevision 必须一致');

    // 3) 外语的版本号**没有**跟着动
    const englishAfterEmergency = fake.getState('product', 'p1', 'en');
    assert.equal(
      englishAfterEmergency?.sourceRevision,
      revisionAfterSync,
      '外语没有重新翻译过，它的 translatedFromRevision 不该动',
    );

    // 4) 外语的字段哈希也没有被改 —— 不声称「这份译文来自新版中文」。
    //    它保留着上一次正常同步时记下的哈希（那时中文还是上一版）
    const staleFields = Object.entries(englishAfterEmergency?.fields ?? {});
    assert.ok(staleFields.length > 0, '上一次同步的哈希记录应当还在');
    for (const [, entry] of staleFields) {
      assert.equal(entry.model, settings.model, '哈希仍是上一次真实翻译留下的，没有被覆盖');
    }
  });

  test('系统能准确判断外语落后：记录里的版本号 < 中文版本号', async () => {
    const fake = chineseOnly();
    await syncEntity(fake.db, settings, 'product', 'p1');

    await editChinese(fake, '满力（应急）');
    const plan = await planSync(fake.db, 'product', 'p1');
    assert.ok(plan);

    const coverage = await localeCoverage(fake.db, 'product', 'p1');
    await performEmergencyPublish(fake.db, {
      entityType: 'product',
      entityId: 'p1',
      reason: 'DeepSeek 超时',
      failureKind: 'timeout',
      revision: plan.revision,
      sourceHash: plan.hash,
      coverage,
      userId: 'u1',
    });

    const chineseRevision = fake.getRevision('product', 'p1')?.revision ?? 0;
    const englishRevision = fake.getState('product', 'p1', 'en')?.sourceRevision ?? 0;
    assert.ok(
      englishRevision < chineseRevision,
      `英文记录在 ${englishRevision} 版、中文已经到 ${chineseRevision} 版 —— 落后必须是算得出来的`,
    );

    // 并且在同步计划里也体现为待同步
    const after = await planSync(fake.db, 'product', 'p1');
    assert.ok(after);
    assert.equal(after.locales.find((item) => item.locale === 'en')?.state, 'stale');
  });

  test('自动补齐之后，外语才推进到应急发布对应的中文版本', async () => {
    const fake = chineseOnly();
    await syncEntity(fake.db, settings, 'product', 'p1');

    await editChinese(fake, '满力（应急）');
    const plan = await planSync(fake.db, 'product', 'p1');
    assert.ok(plan);

    const coverage = await localeCoverage(fake.db, 'product', 'p1');
    await performEmergencyPublish(fake.db, {
      entityType: 'product',
      entityId: 'p1',
      reason: 'DeepSeek 超时',
      failureKind: 'timeout',
      revision: plan.revision,
      sourceHash: plan.hash,
      coverage,
      userId: 'u1',
    });

    const emergencyRevision = fake.getRevision('product', 'p1')?.revision ?? 0;
    assert.ok((fake.getState('product', 'p1', 'en')?.sourceRevision ?? 0) < emergencyRevision);

    // 复制任务在应急发布里已经排好；推它到跑完
    const job = fake.getReleases('product', 'p1'); // 触发一次读，确认状态
    assert.equal(job.length, 1);

    const pending = await fake.db.translationJob.findFirst({
      where: { kind: 'EMERGENCY_SYNC' },
      select: { id: true },
    });
    assert.ok(pending, '应急发布必须排一个补齐任务');
    const advanced = await advanceJob(fake.db, settings, pending!.id, { budgetMs: 120_000 });
    assert.ok(advanced);
    assert.equal(advanced.progress.status, 'SUCCEEDED');

    const englishFinally = fake.getState('product', 'p1', 'en');
    assert.equal(
      englishFinally?.sourceRevision,
      emergencyRevision,
      '补齐之后外语才推进到应急发布对应的那一版中文',
    );
    assert.equal(englishFinally?.status, 'SYNCED');
  });

  test('补齐任务的幂等键里带着中文哈希，重复应急发布不会排出第二个任务', async () => {
    const fake = chineseOnly();
    await editChinese(fake, '满力（应急）');
    const plan = await planSync(fake.db, 'product', 'p1');
    assert.ok(plan);
    const coverage = await localeCoverage(fake.db, 'product', 'p1');

    const input = {
      entityType: 'product' as const,
      entityId: 'p1',
      reason: 'DeepSeek 超时',
      failureKind: 'timeout' as const,
      revision: plan.revision,
      sourceHash: plan.hash,
      coverage,
      userId: 'u1',
    };
    await performEmergencyPublish(fake.db, input);
    await performEmergencyPublish(fake.db, input);

    const jobs = await fake.db.translationJob.findMany({ where: { kind: 'EMERGENCY_SYNC' } });
    assert.equal(jobs.length, 1, '同一版中文只该有一个补齐任务');
  });
});
