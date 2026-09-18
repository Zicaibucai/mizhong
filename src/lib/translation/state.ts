import { Prisma, type PrismaClient } from '@prisma/client';
import type { Locale } from '@/lib/i18n/config';
import { locales } from '@/lib/i18n/config';
import {
  diffUnits,
  hashDocument,
  hashText,
  pendingUnits,
  type FieldState,
  type SourceDocument,
  type TranslationUnit,
} from './document';
import { getAdapter, type Db } from './adapters';

/**
 * 译文同步状态的持久化。
 *
 * 这里有一个刻意的设计选择：**「过期没过期」是每次读的时候算出来的，不是存下来的。**
 *
 * 存一份 STALE 标记意味着「中文一改就要记得把标记写对」—— 而写中文的地方有后台的
 * 各个保存动作、未来的批量导入、直接改库……只要漏掉一处，那个字段就会永远显示
 * 「已同步」，而它其实已经过期了。这类 bug 不会报错，只会让某几种语言的译文悄悄
 * 停留在旧版本上。
 *
 * 所以：`TranslationState.status` 只记录**上一次尝试的结果**（成功 / 失败 / 进行中），
 * 而「现在该不该重翻」永远由「当前中文哈希 vs 翻译时记录的中文哈希」现场比较得出。
 * 没有失效逻辑，也就没有失效逻辑的 bug。
 */

/** 每种语言的同步状态，供后台「语言同步」页展示 */
export type LocaleSyncState = 'synced' | 'stale' | 'partial' | 'failed' | 'empty';

export interface LocaleSyncSummary {
  locale: Locale;
  state: LocaleSyncState;
  /** 需要重新翻译的字段数 */
  pendingCount: number;
  /** 该语言共有多少字段 */
  totalCount: number;
  translatedAt: Date | null;
  model: string | null;
  lastError: string | null;
}

export interface SyncPlan {
  document: SourceDocument;
  /** 当前中文的内容哈希 */
  hash: string;
  /** 已记录的版本号 */
  storedRevision: number;
  /** 中文自上次记录以来是否真的变了 */
  changed: boolean;
  /** 现场算出的版本号：变了就是 storedRevision + 1 */
  revision: number;
  /** 逐语言的计划 */
  locales: LocaleSyncSummary[];
  /** 逐语言需要重翻的单元 */
  pendingByLocale: Map<Locale, TranslationUnit[]>;
  /** 逐语言要清掉的译文路径（中文已删） */
  clearedByLocale: Map<Locale, string[]>;
  /** 逐语言记录的字段状态，写回时要合并 */
  fieldStatesByLocale: Map<Locale, Record<string, FieldState>>;
  /**
   * 逐语言「已有译文、但没有记录，于是认下来」的字段路径。
   *
   * 调用方**必须**为它们补上哈希（见 `adoptUntrackedTranslations`）：
   * 不补的话，以后中文改了这些字段也永远比对不出差异。
   */
  adoptedByLocale: Map<Locale, string[]>;
}

// ---------------------------------------------------------------------------
// 读取
// ---------------------------------------------------------------------------

export async function readRevision(db: Db, entityType: string, entityId: string) {
  return db.contentRevision.findUnique({ where: { entityType_entityId: { entityType, entityId } } });
}

async function readStates(db: Db, entityType: string, entityId: string) {
  const rows = await db.translationState.findMany({ where: { entityType, entityId } });
  return new Map(rows.map((row) => [row.locale as Locale, row]));
}

function asFieldStates(value: unknown): Record<string, FieldState> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const out: Record<string, FieldState> = {};
  for (const [path, entry] of Object.entries(value as Record<string, unknown>)) {
    if (!entry || typeof entry !== 'object') continue;
    const hash = (entry as { hash?: unknown }).hash;
    if (typeof hash !== 'string') continue;
    const at = (entry as { at?: unknown }).at;
    const model = (entry as { model?: unknown }).model;
    out[path] = {
      hash,
      at: typeof at === 'string' ? at : undefined,
      model: typeof model === 'string' ? model : undefined,
    };
  }
  return out;
}

// ---------------------------------------------------------------------------
// 计算同步计划
// ---------------------------------------------------------------------------

/**
 * 算出「这条内容、这些语言，现在各自需要做什么」。
 *
 * 纯读取，不写数据库 —— 后台列表、发布前检查、任务创建前都调用它，
 * 因此这几个地方看到的判断永远是同一份，不会出现「列表说已同步、发布说要重翻」。
 */
export async function planSync(
  db: Db,
  entityType: string,
  entityId: string,
  targets: readonly Locale[] = locales,
): Promise<SyncPlan | null> {
  const adapter = getAdapter(entityType);
  if (!adapter) return null;

  const document = await adapter.readSource(db, entityId);
  if (!document) return null;

  const hash = hashDocument(document.units);
  const revisionRow = await readRevision(db, entityType, entityId);
  const storedRevision = revisionRow?.revision ?? 0;
  const changed = !revisionRow || revisionRow.sourceHash !== hash;
  /** 现场算出的版本号：内容变了就是下一版，没变就是当前这一版 */
  const revision = changed ? storedRevision + 1 : storedRevision;

  const states = await readStates(db, entityType, entityId);
  const summaries: LocaleSyncSummary[] = [];
  const pendingByLocale = new Map<Locale, TranslationUnit[]>();
  const clearedByLocale = new Map<Locale, string[]>();
  const fieldStatesByLocale = new Map<Locale, Record<string, FieldState>>();
  const adoptedByLocale = new Map<Locale, string[]>();

  // 一次把所有语言的现有译文读出来：草稿型的内容（商品、页面）只加载一次草稿，
  // 而不是每种语言各加载一遍
  const targetsToRead = targets.filter((locale) => locale !== 'zh');
  const currentByLocale = await adapter.readTargets(db, entityId, targetsToRead);

  for (const locale of targetsToRead) {
    const state = states.get(locale);
    const fieldStates = asFieldStates(state?.fields);
    const current = currentByLocale[locale] ?? {};

    /**
     * **明确标记为 stale** 的语言：整条重翻，不看哈希。
     *
     * 唯一写入这个状态的地方是应急发布 —— 那时我们**知道**译文是旧的
     * （中文刚改过而翻译服务挂了），不需要、也不该靠哈希去猜。
     * 而不写下任何哈希，正是需求里「不得伪造 sourceHash」那条要求的落点。
     *
     * 它在下一次成功同步后自动消失（recordSuccess 会把状态写回 SYNCED），
     * 所以不会变成一个永远甩不掉的标记。
     */
    const explicitlyStale = state?.status === 'STALE';

    const diffs = diffUnits(document.units, current, fieldStates);
    const pending = explicitlyStale ? [...document.units] : pendingUnits(diffs, document.units);

    /**
     * 「认下来」的字段：有译文、但没有逐字段记录。
     *
     * 这些字段不重翻（需求 6.7 要求保留人工调整过的译文），但**必须补上哈希记录** ——
     * 不补的话，以后中文改了它们也永远比对不出差异，会一直停在旧译文上，
     * 而界面显示「已是最新」。这是采纳规则唯一不显然的地方，漏了就是最难查的那类 bug。
     */
    const adopted = explicitlyStale
      ? []
      : document.units
          .filter((unit) => (current[unit.path] ?? '').trim() && !fieldStates[unit.path])
          .map((unit) => unit.path);

    // 中文删掉的字段：我们翻译过、但现在文档里没有了 → 译文要一并清掉
    const live = new Set(document.units.map((unit) => unit.path));
    const cleared = Object.keys(fieldStates).filter((path) => !live.has(path));

    const totalCount = document.units.length;
    const pendingCount = pending.length + cleared.length;

    let state_: LocaleSyncState;
    if (totalCount === 0 && cleared.length === 0) state_ = 'empty';
    else if (state?.status === 'FAILED') state_ = 'failed';
    else if (pendingCount === 0) state_ = 'synced';
    else if (explicitlyStale || pendingCount === totalCount + cleared.length) state_ = 'stale';
    else state_ = 'partial';

    summaries.push({
      locale,
      state: state_,
      pendingCount,
      totalCount,
      translatedAt: state?.translatedAt ?? null,
      model: state?.translationModel ?? null,
      lastError: state?.lastError ?? null,
    });
    pendingByLocale.set(locale, pending);
    clearedByLocale.set(locale, cleared);
    fieldStatesByLocale.set(locale, fieldStates);
    adoptedByLocale.set(locale, adopted);
  }

  return {
    document,
    hash,
    storedRevision,
    changed,
    revision,
    locales: summaries,
    pendingByLocale,
    clearedByLocale,
    fieldStatesByLocale,
    adoptedByLocale,
  };
}

// ---------------------------------------------------------------------------
// 写入
// ---------------------------------------------------------------------------

/**
 * 把中文版本号推进到当前内容，并返回钉住的版本号。
 *
 * **只在同步真正开始前调用**。把版本推进与「开始翻译」绑在一起，是为了让
 * 「同一批译文来自同一版中文」（需求 8.5）成为一条可以直接查证的约束：
 * 任务里每个工作项都记着当时的版本号，事后能对得上。
 */
export async function commitRevision(
  db: PrismaClient,
  entityType: string,
  entityId: string,
  hash: string,
): Promise<number> {
  const row = await db.contentRevision.findUnique({ where: { entityType_entityId: { entityType, entityId } } });
  if (row && row.sourceHash === hash) return row.revision;

  const next = (row?.revision ?? 0) + 1;
  await db.contentRevision.upsert({
    where: { entityType_entityId: { entityType, entityId } },
    create: { entityType, entityId, revision: next, sourceHash: hash },
    update: { revision: next, sourceHash: hash },
  });
  return next;
}

/** 标记「正在翻译」，用于并发互斥与进度展示 */
export async function markTranslating(
  db: PrismaClient,
  entityType: string,
  entityId: string,
  targetLocales: readonly Locale[],
): Promise<void> {
  for (const locale of targetLocales) {
    await db.translationState.upsert({
      where: { entityType_entityId_locale: { entityType, entityId, locale } },
      create: { entityType, entityId, locale, status: 'TRANSLATING' },
      update: { status: 'TRANSLATING' },
    });
  }
}

/**
 * 记录一次成功。
 *
 * `fieldStates` 是**合并后**的完整状态：既包含这次翻的新字段，也保留之前已经同步
 * 的字段 —— 中文没变的字段不该因为「这一批没翻它」就丢掉记录，那会让它下次被误判成
 * missing（需求 6.8）。
 */
export async function recordSuccess(
  db: PrismaClient,
  input: {
    entityType: string;
    entityId: string;
    locale: Locale;
    revision: number;
    model: string;
    fieldStates: Record<string, FieldState>;
    /** 这次实际翻出来的字段路径 */
    translatedPaths: readonly string[];
  },
): Promise<void> {
  const at = new Date().toISOString();
  const merged: Record<string, FieldState> = { ...input.fieldStates };
  const source = new Map<string, string>();

  // 重新读一次中文，把这次翻的字段的哈希记准 —— 记的是**翻译当时**的中文，
  // 不是调用方传进来的可能已经过期的副本。
  const document = await getAdapter(input.entityType)?.readSource(db, input.entityId);
  for (const unit of document?.units ?? []) source.set(unit.path, hashText(unit.text));

  for (const path of input.translatedPaths) {
    const hash = source.get(path);
    if (hash) merged[path] = { hash, at, model: input.model };
  }

  await db.translationState.upsert({
    where: {
      entityType_entityId_locale: {
        entityType: input.entityType,
        entityId: input.entityId,
        locale: input.locale,
      },
    },
    create: {
      entityType: input.entityType,
      entityId: input.entityId,
      locale: input.locale,
      sourceRevision: input.revision,
      fields: merged as unknown as Prisma.InputJsonValue,
      status: 'SYNCED',
      translatedAt: new Date(),
      translationModel: input.model,
      lastError: null,
      failureCount: 0,
    },
    update: {
      sourceRevision: input.revision,
      fields: merged as unknown as Prisma.InputJsonValue,
      status: 'SYNCED',
      translatedAt: new Date(),
      translationModel: input.model,
      lastError: null,
      failureCount: 0,
    },
  });
}

/**
 * 把中文已经删掉的字段从状态里抹去，并写回数据库让译文真的消失。
 *
 * 单独一个函数是因为它不依赖 DeepSeek：中文清空时**不应该产生任何 API 调用**，
 * 却必须把译文清干净（需求 6.3 / 6.9）。
 */
export async function recordCleared(
  db: PrismaClient,
  input: {
    entityType: string;
    entityId: string;
    locale: Locale;
    cleared: readonly string[];
    fieldStates: Record<string, FieldState>;
  },
): Promise<void> {
  if (input.cleared.length === 0) return;

  const merged: Record<string, FieldState> = { ...input.fieldStates };
  for (const path of input.cleared) delete merged[path];

  await db.translationState.upsert({
    where: {
      entityType_entityId_locale: {
        entityType: input.entityType,
        entityId: input.entityId,
        locale: input.locale,
      },
    },
    create: {
      entityType: input.entityType,
      entityId: input.entityId,
      locale: input.locale,
      fields: merged as unknown as Prisma.InputJsonValue,
      status: 'SYNCED',
      translatedAt: new Date(),
    },
    update: { fields: merged as unknown as Prisma.InputJsonValue },
  });
}

/**
 * 把若干语言**明确标记为 stale**：中文变了、译文确定是旧的，等翻译服务恢复后再补。
 *
 * 应急发布专用。它做两件刻意的选择：
 *   - **不碰 fields**。不写哈希就等于不声称「这些译文是从当前中文来的」——
 *     那正是需求里禁止伪造的 sourceHash；
 *   - **不改这一行的 sourceRevision**。这里是**各语言**的记录，它们没有重新翻译过
 *     就不该说「来自新版中文」。
 *
 * 注意与**中文自己的**版本号区分开：中文的 `ContentRevision` 在应急发布时
 * 照常推进（内容确实变了），于是各语言记录里的旧版本号与它之间就有了明确的大小
 * 关系 —— 「落后」是算出来的，不是靠一个标记去断言。两者缺一不可。
 *
 * 效果：下一次同步会把整条内容重翻一遍（planSync 认这个标记），
 * 成功之后标记与版本号一起被 recordSuccess 更新。
 */
export async function markExplicitlyStale(
  db: PrismaClient,
  input: { entityType: string; entityId: string; locales: readonly Locale[] },
): Promise<void> {
  for (const locale of input.locales) {
    if (locale === 'zh') continue;
    await db.translationState.upsert({
      where: {
        entityType_entityId_locale: {
          entityType: input.entityType,
          entityId: input.entityId,
          locale,
        },
      },
      create: { entityType: input.entityType, entityId: input.entityId, locale, status: 'STALE' },
      update: { status: 'STALE', lastError: null },
    });
  }
}

/**
 * 给「认下来」的字段补上哈希记录。
 *
 * 这一步**不产生任何 API 调用**，但它是采纳规则能长期成立的前提：没有它，
 * 被认下来的字段永远比对不出「中文改过了」，会一直停在旧译文上而界面显示已同步。
 *
 * 记录的 model 写成 `adopted` 而不是真实的模型名，是因为这些字段确实**没有**被这台
 * 机器翻译过 —— 把来源写清楚，日后查「这段译文哪来的」时不会误导人。
 */
export async function adoptUntrackedTranslations(
  db: PrismaClient,
  entityType: string,
  entityId: string,
  plan: SyncPlan,
): Promise<number> {
  const at = new Date().toISOString();
  const sourceHash = new Map(plan.document.units.map((unit) => [unit.path, hashText(unit.text)]));
  let adopted = 0;

  for (const [locale, paths] of plan.adoptedByLocale) {
    if (paths.length === 0) continue;

    const merged: Record<string, FieldState> = { ...(plan.fieldStatesByLocale.get(locale) ?? {}) };
    for (const path of paths) {
      const hash = sourceHash.get(path);
      if (hash) merged[path] = { hash, at, model: 'adopted' };
    }

    await db.translationState.upsert({
      where: { entityType_entityId_locale: { entityType, entityId, locale } },
      create: {
        entityType,
        entityId,
        locale,
        fields: merged as unknown as Prisma.InputJsonValue,
        status: 'SYNCED',
      },
      // 只并字段状态：这两个字段确实是「有内容且最新」的，翻译时间与模型保持不变
      update: { fields: merged as unknown as Prisma.InputJsonValue },
    });
    adopted += paths.length;
  }

  return adopted;
}

/** 记录一次失败。`reason` 是已归类的错误类别，不含 Key、原文或译文。 */
export async function recordFailure(
  db: PrismaClient,
  input: { entityType: string; entityId: string; locale: Locale; reason: string },
): Promise<void> {
  await db.translationState.upsert({
    where: {
      entityType_entityId_locale: {
        entityType: input.entityType,
        entityId: input.entityId,
        locale: input.locale,
      },
    },
    create: {
      entityType: input.entityType,
      entityId: input.entityId,
      locale: input.locale,
      status: 'FAILED',
      lastError: input.reason,
      failureCount: 1,
    },
    update: { status: 'FAILED', lastError: input.reason, failureCount: { increment: 1 } },
  });
}

// ---------------------------------------------------------------------------
// 失效
// ---------------------------------------------------------------------------

/**
 * 把一条内容的同步状态整个清掉：版本号与逐字段记录一起删。
 *
 * 用在「内容被整体换掉」的地方 —— 恢复到某个历史版本、丢弃草稿回到线上。
 * 这些操作**不经过翻译引擎**就改变了内容，如果不同时清掉状态，就会出现
 * 「记录说已同步、线上其实是另一个版本」这种最难查的不一致。
 *
 * 清掉之后下一次同步会把全部字段重翻一遍（记录没了 → 按脏数据处理）。
 * 代价是一次多余的翻译，换来的是「界面上的状态一定是真的」。
 */
export async function invalidateTranslationState(
  db: PrismaClient,
  entityType: string,
  entityId: string,
): Promise<void> {
  await db.translationState.deleteMany({ where: { entityType, entityId } });
  await db.contentRevision.deleteMany({ where: { entityType, entityId } });
}

// ---------------------------------------------------------------------------
// 发布记录
// ---------------------------------------------------------------------------

/**
 * 记下一次成功发布。
 *
 * 存在的意义是回答「这一版线上内容里，中文和各语言是不是同一次发布出去的」。
 * 内容自己的版本快照（ProductVersion / PageVersion）带上这里返回的 id，
 * 因此「整组回滚」有了一个明确的边界：同一个 releaseId 的那些语言属于同一版。
 *
 * **只在真正写进线上之后调用** —— 失败或部分成功的同步不该留下发布记录，
 * 否则历史里会出现「发布过，但线上其实没变」的幻影版本。
 */
export async function recordRelease(
  db: PrismaClient | Prisma.TransactionClient,
  input: {
    entityType: string;
    entityId: string;
    revision: number;
    locales: readonly Locale[];
    model: string | null;
    userId: string | null;
    result?: Record<string, unknown>;
    /**
     * 正常发布还是应急发布。默认 FULL —— 只有应急发布这一条路径会传 EMERGENCY，
     * 因此不会出现「忘了标记」导致事后分不清某条内容的多语言齐不齐。
     */
    kind?: 'FULL' | 'EMERGENCY';
    /** 应急发布时管理员填写的原因 */
    reason?: string | null;
    /** 应急发布时翻译失败的类型（已归类，不含原文译文与密钥） */
    failureKind?: string | null;
  },
): Promise<string> {
  const release = await db.contentRelease.create({
    data: {
      entityType: input.entityType,
      entityId: input.entityId,
      revision: input.revision,
      locales: [...input.locales],
      model: input.model,
      publishedById: input.userId,
      result: (input.result ?? null) as unknown as Prisma.InputJsonValue,
      kind: input.kind ?? 'FULL',
      reason: input.reason ?? null,
      failureKind: input.failureKind ?? null,
    },
    select: { id: true },
  });
  return release.id;
}

/** 最近一次成功发布，用于「这一版是不是同一次发布出去的」这类查证 */
export async function latestRelease(db: Db, entityType: string, entityId: string) {
  return db.contentRelease.findFirst({
    where: { entityType, entityId },
    orderBy: { publishedAt: 'desc' },
  });
}

// ---------------------------------------------------------------------------
// 全站概览
// ---------------------------------------------------------------------------

export interface EntitySyncOverview {
  entityType: string;
  entityId: string;
  label: string;
  hint?: string;
  revision: number;
  /** 中文自上次记录以来是否变了 */
  changed: boolean;
  syncedLocales: number;
  pendingLocales: number;
  failedLocales: number;
  totalLocales: number;
  lastSyncedAt: Date | null;
}

/** 把一份计划压成后台列表要的一行 */
export function summarizeEntity(
  entityType: string,
  entityId: string,
  label: string,
  hint: string | undefined,
  plan: SyncPlan,
  lastSyncedAt: Date | null,
): EntitySyncOverview {
  let synced = 0;
  let pending = 0;
  let failed = 0;
  for (const summary of plan.locales) {
    if (summary.state === 'empty') continue;
    if (summary.state === 'synced') synced += 1;
    else pending += 1;
    if (summary.state === 'failed') failed += 1;
  }
  return {
    entityType,
    entityId,
    label,
    hint,
    revision: plan.revision,
    changed: plan.changed,
    syncedLocales: synced,
    pendingLocales: pending,
    failedLocales: failed,
    totalLocales: plan.locales.filter((item) => item.state !== 'empty').length,
    lastSyncedAt,
  };
}
