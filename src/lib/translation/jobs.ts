import type { PrismaClient } from '@prisma/client';
import { locales, type Locale } from '@/lib/i18n/config';
import { ADAPTERS, getAdapter, targetLocales, type ContentType } from './adapters';
import { syncEntity, type EntitySyncResult } from './engine';
import { planSync } from './state';
import type { TranslationSettings } from './settings';

/**
 * 翻译长任务。
 *
 * 首页和全站内容的翻译可能远超单个 Server Action 的时限，所以**不**把它塞进一个
 * 长时间挂着的请求里：任务与每个工作项的状态落在数据库，每次推进只处理一小批
 * （默认 20 秒预算，远低于 60 秒），关掉浏览器不损坏任何东西，重新打开继续看进度。
 *
 * 两个刻意不做的事：
 *
 *   **不记「跑到第几个」的游标。** 断点就是工作项自己的状态 —— PENDING 的还没做，
 *   SYNCED 的已经做完。这样重试、跳过、补跑都不需要额外维护一个位置，
 *   也就不会有「游标说跑完了、其实有一项没做」的可能。
 *
 *   **不排队。** 已有任务在跑时，第二次点击返回的是**同一个**任务，不是新开一个。
 *   取锁失败的调用方直接读当前进度返回。
 */

/** 一次同步覆盖的一条内容 */
export interface ScopeTarget {
  entityType: ContentType;
  entityId: string;
  label: string;
  hint?: string;
}

export interface JobProgress {
  id: string;
  kind: string;
  status: string;
  totalItems: number;
  completedItems: number;
  failedItems: number;
  pendingItems: number;
  requestCount: number;
  tokenEstimate: number;
  startedAt: string | null;
  finishedAt: string | null;
  lastError: string | null;
  /** 失败的工作项明细，供「查看错误」展示 */
  failures: { entityType: string; entityId: string; label: string | null; locale: string; error: string | null }[];
}

/** 未结束的任务状态：还有事情要做 */
const OPEN_STATUSES = ['PENDING', 'RUNNING'] as const;

/** 锁超时：超过这个时间没动静就认为上一个推进者已经不在了 */
const LOCK_TIMEOUT_MS = 2 * 60 * 1000;

export type JobKind = 'PUBLISH' | 'SYNC_ONE' | 'SYNC_ALL' | 'RETRY_FAILED';

// ---------------------------------------------------------------------------
// 盘点范围
// ---------------------------------------------------------------------------

/**
 * 列出全站「已发布的中文内容」。
 *
 * 每种内容类型自己说了算什么叫「已发布」：商品看 `published`，页面看 `status`，
 * 导航/联系方式/类目/素材看 `enabled`，公司资料是单例永远在。这个判断放在适配器里
 * （见 adapters.ts 的 listScope），不在这里按类型写一串 if —— 加类型时不会漏。
 */
export async function collectScope(
  db: PrismaClient,
  types: readonly ContentType[] = Object.keys(ADAPTERS) as ContentType[],
): Promise<ScopeTarget[]> {
  const out: ScopeTarget[] = [];
  for (const type of types) {
    const rows = await ADAPTERS[type].listScope(db);
    for (const row of rows) {
      out.push({ entityType: type, entityId: row.entityId, label: row.label, hint: row.hint });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// 创建任务
// ---------------------------------------------------------------------------

export interface CreateJobInput {
  kind: JobKind;
  targets: ScopeTarget[];
  /** 目标语言；不传表示全部非中文语言 */
  locales?: Locale[];
  /**
   * 幂等键。同一个键只会创建一次任务 —— 重复点击发布不会翻译两遍。
   * 键里应当包含「内容 + 中文版本」，这样同一次发布重入时能认出彼此。
   */
  idempotencyKey?: string | null;
  userId?: string | null;
}

export interface CreateJobResult {
  jobId: string;
  /** false 表示复用了已有任务，没有新建 */
  created: boolean;
  totalItems: number;
}

/**
 * 创建一个同步任务。
 *
 * 「全站同步」这种没有天然幂等键的任务，用「是不是已经有一个同类任务在跑」来兜底：
 * 连点两下不会并行跑两轮。
 */
export async function createJob(db: PrismaClient, input: CreateJobInput): Promise<CreateJobResult> {
  const targets = dedupeTargets(input.targets);
  const targetLocalesToUse = input.locales ?? targetLocales(locales);

  if (input.idempotencyKey) {
    const existing = await db.translationJob.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
      select: { id: true, totalItems: true },
    });
    if (existing) return { jobId: existing.id, created: false, totalItems: existing.totalItems };
  }

  // 已经有同类任务在跑 → 复用它，不新开
  const running = await db.translationJob.findFirst({
    where: { kind: input.kind, status: { in: [...OPEN_STATUSES] } },
    orderBy: { createdAt: 'desc' },
    select: { id: true, totalItems: true },
  });
  if (running) return { jobId: running.id, created: false, totalItems: running.totalItems };

  const job = await db.translationJob.create({
    data: {
      kind: input.kind,
      status: 'PENDING',
      idempotencyKey: input.idempotencyKey ?? null,
      createdById: input.userId ?? null,
      totalItems: targets.length * targetLocalesToUse.length,
    },
    select: { id: true },
  });

  if (targets.length > 0) {
    await db.translationJobItem.createMany({
      data: targets.flatMap((target, entityIndex) =>
        targetLocalesToUse.map((locale, localeIndex) => ({
          jobId: job.id,
          entityType: target.entityType,
          entityId: target.entityId,
          locale,
          revision: 0,
          // 顺序稳定：同一组目标每次创建的排列完全一致，断点才有意义
          sortOrder: entityIndex * targetLocalesToUse.length + localeIndex,
        })),
      ),
    });
  }

  return { jobId: job.id, created: true, totalItems: targets.length * targetLocalesToUse.length };
}

function dedupeTargets(targets: readonly ScopeTarget[]): ScopeTarget[] {
  const seen = new Set<string>();
  const out: ScopeTarget[] = [];
  for (const target of targets) {
    const key = `${target.entityType}:${target.entityId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(target);
  }
  return out;
}

/** 只重试上一次任务里失败的工作项 */
export async function createRetryJob(
  db: PrismaClient,
  sourceJobId: string,
  options: { userId?: string | null } = {},
): Promise<CreateJobResult | null> {
  const source = await db.translationJob.findUnique({ where: { id: sourceJobId } });
  if (!source) return null;

  const failed = await db.translationJobItem.findMany({
    where: { jobId: sourceJobId, status: 'FAILED' },
    orderBy: { sortOrder: 'asc' },
    select: { entityType: true, entityId: true, locale: true },
  });
  if (failed.length === 0) return null;

  const targets: ScopeTarget[] = [];
  for (const row of failed) {
    const adapter = getAdapter(row.entityType);
    const id = row.entityId;
    // 失败项可能来自已被删掉的内容；那种情况下不该再去翻它
    const alive = adapter ? await adapter.readSource(db, id) : null;
    if (!alive) continue;
    targets.push({ entityType: row.entityType as ContentType, entityId: id, label: id });
  }
  if (targets.length === 0) return null;

  return createJob(db, {
    kind: 'RETRY_FAILED',
    targets,
    locales: [...new Set(failed.map((row) => row.locale as Locale))],
    userId: options.userId ?? null,
  });
}

// ---------------------------------------------------------------------------
// 推进任务
// ---------------------------------------------------------------------------

export interface AdvanceOptions {
  /** 本次推进的时间预算，默认 20 秒 */
  budgetMs?: number;
  /** 最多处理几条内容，默认不限（由时间预算决定） */
  maxEntities?: number;
}

export interface AdvanceResult {
  progress: JobProgress;
  /** 还有工作项待处理 —— 调用方应当再调一次 */
  hasMore: boolean;
  /** 没拿到锁：另一次推进正在进行，返回的是当前进度 */
  busy: boolean;
}

const DEFAULT_ADVANCE_BUDGET_MS = 20_000;

/**
 * 推进任务：处理下一批内容。
 *
 * 可以安全地反复调用 —— 已经 SYNCED 的工作项不会重做，因此「再点一次」
 * 与「上一次还没跑完时自动续跑」是同一件事。
 */
export async function advanceJob(
  db: PrismaClient,
  settings: TranslationSettings,
  jobId: string,
  options: AdvanceOptions = {},
): Promise<AdvanceResult | null> {
  const job = await db.translationJob.findUnique({ where: { id: jobId } });
  if (!job) return null;

  if (!OPEN_STATUSES.includes(job.status as (typeof OPEN_STATUSES)[number])) {
    // 已经结束的任务：直接返回结果，不要重跑一遍
    return { progress: await getJobProgress(db, jobId), hasMore: false, busy: false };
  }

  const lock = await acquireLock(db, jobId);
  if (!lock) {
    return { progress: await getJobProgress(db, jobId), hasMore: true, busy: true };
  }

  const deadline = Date.now() + (options.budgetMs ?? DEFAULT_ADVANCE_BUDGET_MS);
  const maxEntities = options.maxEntities ?? Number.POSITIVE_INFINITY;

  try {
    if (job.status === 'PENDING') {
      await db.translationJob.update({
        where: { id: jobId },
        data: { status: 'RUNNING', startedAt: job.startedAt ?? new Date() },
      });
    }

    let processed = 0;
    let lastError: string | null = null;

    while (Date.now() < deadline && processed < maxEntities) {
      const pending = await db.translationJobItem.findFirst({
        where: { jobId, status: 'PENDING' },
        orderBy: { sortOrder: 'asc' },
        select: { entityType: true, entityId: true },
      });
      if (!pending) break;

      const items = await db.translationJobItem.findMany({
        where: {
          jobId,
          entityType: pending.entityType,
          entityId: pending.entityId,
          status: 'PENDING',
        },
        select: { locale: true },
      });

      const entityLocales = items.map((row) => row.locale as Locale);
      const result = await syncEntity(db, settings, pending.entityType, pending.entityId, {
        locales: entityLocales,
        budgetMs: Math.max(1_000, deadline - Date.now()),
      });

      if (!result) {
        // 内容已经不存在了（被删掉）：这一批直接作废，不要卡住整个任务
        await db.translationJobItem.updateMany({
          where: { jobId, entityType: pending.entityType, entityId: pending.entityId, status: 'PENDING' },
          data: { status: 'SKIPPED', finishedAt: new Date() },
        });
        processed += 1;
        continue;
      }

      await applyEntityResult(db, jobId, pending.entityType, pending.entityId, result);
      processed += 1;

      if (result.error) lastError = result.error;
      else if (result.locales.some((item) => item.outcome === 'failed')) {
        lastError = result.locales.find((item) => item.outcome === 'failed')?.error ?? null;
      }

      // 这一条内容还没做完（时间不够），下一轮继续 —— 但要先把循环让出去
      if (result.hasMore) break;
    }

    await refreshTotals(db, jobId, lastError);
    await finalizeIfDone(db, jobId);
  } finally {
    await releaseLock(db, jobId);
  }

  const progress = await getJobProgress(db, jobId);
  return { progress, hasMore: progress.pendingItems > 0, busy: false };
}

/** 把一条内容的同步结果落到它的工作项上 */
async function applyEntityResult(
  db: PrismaClient,
  jobId: string,
  entityType: string,
  entityId: string,
  result: EntitySyncResult,
): Promise<void> {
  const byLocale = new Map(result.locales.map((item) => [item.locale, item]));

  const items = await db.translationJobItem.findMany({
    where: { jobId, entityType, entityId, status: 'PENDING' },
    select: { id: true, locale: true, attempts: true },
  });

  for (const item of items) {
    const outcome = byLocale.get(item.locale as Locale);
    const base = { attempts: { increment: 1 }, startedAt: new Date() };

    if (!outcome) {
      // 这一语言这次没轮到（时间不够）→ 保持 PENDING，不做任何结算
      if (result.hasMore) continue;
      await db.translationJobItem.update({
        where: { id: item.id },
        data: { ...base, status: 'FAILED', lastError: result.error ?? 'not-attempted', finishedAt: new Date() },
      });
      continue;
    }

    if (outcome.outcome === 'failed') {
      await db.translationJobItem.update({
        where: { id: item.id },
        data: { ...base, status: 'FAILED', lastError: outcome.error ?? 'unknown', finishedAt: new Date() },
      });
      continue;
    }

    if (outcome.outcome === 'pending') {
      await db.translationJobItem.update({ where: { id: item.id }, data: base });
      continue;
    }

    await db.translationJobItem.update({
      where: { id: item.id },
      data: {
        ...base,
        status: 'SYNCED',
        revision: result.revision,
        lastError: null,
        finishedAt: new Date(),
      },
    });
  }

  // 请求数与 token 估算累加到任务上（单条内容的明细已经在引擎里算过了）
  if (result.requestCount > 0) {
    await db.translationJob.update({
      where: { id: jobId },
      data: {
        requestCount: { increment: result.requestCount },
        tokenEstimate: { increment: result.tokenEstimate },
      },
    });
  }
}

/** 重算任务级的计数 */
async function refreshTotals(db: PrismaClient, jobId: string, lastError: string | null): Promise<void> {
  const [total, synced, failed, skipped] = await Promise.all([
    db.translationJobItem.count({ where: { jobId } }),
    db.translationJobItem.count({ where: { jobId, status: 'SYNCED' } }),
    db.translationJobItem.count({ where: { jobId, status: 'FAILED' } }),
    db.translationJobItem.count({ where: { jobId, status: 'SKIPPED' } }),
  ]);

  await db.translationJob.update({
    where: { id: jobId },
    data: {
      totalItems: total,
      completedItems: synced + skipped,
      failedItems: failed,
      ...(lastError ? { lastError: lastError.slice(0, 200) } : {}),
    },
  });
}

/**
 * 全部工作项都结算完了就收尾。
 *
 * 这里多做一件事：**再算一次同步计划**。工作项说「都成功了」不等于内容真的同步了 ——
 * 同步过程中有人改了中文的话，已经翻好的字段又会重新变成待同步。发布类任务在这种
 * 情况下必须失败，而不是对外宣称发布成功（需求 8.5：同一批次的来源必须一致）。
 */
async function finalizeIfDone(db: PrismaClient, jobId: string): Promise<void> {
  const pending = await db.translationJobItem.count({ where: { jobId, status: 'PENDING' } });
  if (pending > 0) return;

  const [total, failed, synced] = await Promise.all([
    db.translationJobItem.count({ where: { jobId } }),
    db.translationJobItem.count({ where: { jobId, status: 'FAILED' } }),
    db.translationJobItem.count({ where: { jobId, status: 'SYNCED' } }),
  ]);

  const job = await db.translationJob.findUnique({ where: { id: jobId }, select: { kind: true } });

  // 任务结束后再确认一次内容层面确实没有待同步的字段
  const stale = await findStillPending(db, jobId);

  let status: 'SUCCEEDED' | 'PARTIAL' | 'FAILED';
  if (total === 0) status = 'SUCCEEDED';
  else if (failed === 0 && synced > 0 && stale.length === 0) status = 'SUCCEEDED';
  else if (synced === 0) status = 'FAILED';
  else status = 'PARTIAL';

  await db.translationJob.update({
    where: { id: jobId },
    data: {
      status,
      finishedAt: new Date(),
      ...(stale.length > 0
        ? {
            lastError:
              job?.kind === 'PUBLISH'
                ? 'source-changed' // 中文在同步过程中被改过，本次发布作废
                : 'still-pending',
          }
        : {}),
    },
  });
}

/** 任务结束后仍处于待同步状态的内容（用于发布前的一致性检查） */
async function findStillPending(
  db: PrismaClient,
  jobId: string,
): Promise<{ entityType: string; entityId: string }[]> {
  const rows = await db.translationJobItem.findMany({
    where: { jobId, status: 'SYNCED' },
    select: { entityType: true, entityId: true },
    distinct: ['entityType', 'entityId'],
  });

  const out: { entityType: string; entityId: string }[] = [];
  for (const row of rows) {
    const plan = await planSync(db, row.entityType, row.entityId);
    if (!plan) continue;
    if (plan.changed || plan.locales.some((item) => item.state !== 'synced' && item.state !== 'empty')) {
      out.push(row);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// 锁
// ---------------------------------------------------------------------------

async function acquireLock(db: PrismaClient, jobId: string): Promise<boolean> {
  const now = new Date();
  const staleBefore = new Date(now.getTime() - LOCK_TIMEOUT_MS);

  // 条件更新是原子的：只有一个调用方能把它从「没锁 / 锁过期」改成「我锁上了」
  const claimed = await db.translationJob.updateMany({
    where: { id: jobId, OR: [{ lockedAt: null }, { lockedAt: { lt: staleBefore } }] },
    data: { lockedAt: now },
  });
  return claimed.count === 1;
}

async function releaseLock(db: PrismaClient, jobId: string): Promise<void> {
  await db.translationJob
    .updateMany({ where: { id: jobId }, data: { lockedAt: null } })
    .catch(() => undefined);
}

// ---------------------------------------------------------------------------
// 发布自带的同步保险
// ---------------------------------------------------------------------------

export type PublishSyncStatus = 'ready' | 'working' | 'failed';

export interface PublishSyncOutcome {
  status: PublishSyncStatus;
  jobId: string | null;
  /** 还没做完时，界面据此显示「已翻译 3/10 种语言」 */
  progress: JobProgress | null;
  /** 中文自上次同步以来有没有变化 */
  changed: boolean;
  revision: number;
}

/**
 * 发布前的同步保险：把这条内容中文的改动补齐到全部目标语言。
 *
 * 这是需求里那句「即使管理员修改中文后没有再次点击一键翻译，点击发布时也要自动
 * 翻译最新内容」的落点。三条行为：
 *
 *   - **没有待同步字段时零调用。** 计划里一个待翻字段都没有，就直接返回 ready ——
 *     不创建任务、不占并发额度、不发请求。反复点发布不会反复花钱。
 *   - **超时就分多次。** 一次推进只跑一小段预算；没做完返回 `working`，
 *     界面接着调 `advanceJob`，直到跑完再真正发布。
 *   - **失败不许发布。** 任何目标语言没翻成功，返回 `failed`，
 *     调用方据此放弃本次发布 —— 线上保持原样，不会出现新旧语言混着的版本。
 */
export async function syncForPublish(
  db: PrismaClient,
  settings: TranslationSettings,
  entityType: string,
  entityId: string,
  options: { userId?: string | null; budgetMs?: number } = {},
): Promise<PublishSyncOutcome> {
  const plan = await planSync(db, entityType, entityId);
  if (!plan) {
    return { status: 'failed', jobId: null, progress: null, changed: false, revision: 0 };
  }

  const needsWork = plan.locales.some((item) => item.state !== 'synced' && item.state !== 'empty');

  if (!needsWork) {
    return { status: 'ready', jobId: null, progress: null, changed: plan.changed, revision: plan.revision };
  }

  /**
   * 幂等键里带上中文版本号：同一次发布重复点击会命中同一个任务，
   * 中文改了之后版本号变化，自然就是一个新任务 ——
   * 既不会重复翻，也不会因为复用了旧任务而漏翻。
   */
  const { jobId } = await createJob(db, {
    kind: 'PUBLISH',
    targets: [{ entityType: entityType as ContentType, entityId, label: entityId }],
    idempotencyKey: `publish:${entityType}:${entityId}:r${plan.revision}`,
    userId: options.userId ?? null,
  });

  const advanced = await advanceJob(db, settings, jobId, { budgetMs: options.budgetMs });
  const progress = advanced?.progress ?? (await getJobProgress(db, jobId));

  if (progress.pendingItems > 0) {
    return { status: 'working', jobId, progress, changed: plan.changed, revision: plan.revision };
  }

  // 收尾时再算一次计划：同步过程中有人改了中文的话，这里会重新出现待同步字段，
  // 任务状态会是 PARTIAL —— 那种情况下不能发布（需求 8.5）
  if (progress.failedItems > 0 || progress.status !== 'SUCCEEDED') {
    return { status: 'failed', jobId, progress, changed: plan.changed, revision: plan.revision };
  }

  return { status: 'ready', jobId, progress, changed: plan.changed, revision: plan.revision };
}

// ---------------------------------------------------------------------------
// 读取进度
// ---------------------------------------------------------------------------

export async function getJobProgress(db: PrismaClient, jobId: string): Promise<JobProgress> {
  const job = await db.translationJob.findUnique({
    where: { id: jobId },
    select: {
      id: true,
      kind: true,
      status: true,
      totalItems: true,
      completedItems: true,
      failedItems: true,
      requestCount: true,
      tokenEstimate: true,
      startedAt: true,
      finishedAt: true,
      lastError: true,
    },
  });
  if (!job) throw new Error(`job not found: ${jobId}`);

  const pendingItems = await db.translationJobItem.count({ where: { jobId, status: 'PENDING' } });

  const failures = await db.translationJobItem.findMany({
    where: { jobId, status: 'FAILED' },
    orderBy: { sortOrder: 'asc' },
    take: 50,
    select: { entityType: true, entityId: true, locale: true, lastError: true },
  });

  return {
    id: job.id,
    kind: job.kind,
    status: job.status,
    totalItems: job.totalItems,
    completedItems: job.completedItems,
    failedItems: job.failedItems,
    pendingItems,
    requestCount: job.requestCount,
    tokenEstimate: job.tokenEstimate,
    startedAt: job.startedAt?.toISOString() ?? null,
    finishedAt: job.finishedAt?.toISOString() ?? null,
    lastError: job.lastError,
    failures: failures.map((row) => ({
      entityType: row.entityType,
      entityId: row.entityId,
      label: null,
      locale: row.locale,
      error: row.lastError,
    })),
  };
}

/** 最近的任务，供后台列表展示 */
export async function listRecentJobs(db: PrismaClient, limit = 10) {
  return db.translationJob.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      id: true,
      kind: true,
      status: true,
      totalItems: true,
      completedItems: true,
      failedItems: true,
      requestCount: true,
      tokenEstimate: true,
      createdAt: true,
      finishedAt: true,
      lastError: true,
      createdBy: { select: { email: true, name: true } },
    },
  });
}
