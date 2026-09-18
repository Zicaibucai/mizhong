import type { PrismaClient } from '@prisma/client';
import { locales, type Locale } from '@/lib/i18n/config';
import { translateUnitBatch, type TranslationErrorKind } from './deepseek';
import type { TranslationSettings } from './settings';
import { getAdapter, targetLocales } from './adapters';
import {
  estimateBatchTokens,
  splitIntoBatches,
  type TranslationUnit,
} from './document';
import {
  adoptUntrackedTranslations,
  commitRevision,
  markTranslating,
  planSync,
  recordCleared,
  recordFailure,
  recordSuccess,
  type SyncPlan,
} from './state';

/**
 * 同步引擎：把「一条内容的中文」变成「全部目标语言的译文」。
 *
 * 这里是**唯一**真正调用 DeepSeek 并写回译文的地方。后台的「一键翻译」「发布时
 * 自动同步」「全站同步」「只重试失败」全部经由它 —— 四条入口一条实现，
 * 不会出现「手动点能翻、全站同步漏翻」这种解释不清的差异。
 *
 * 三条贯穿始终的性质：
 *
 *   **只翻变了的部分。** 每个字段记着「翻译当时中文的哈希」，比对得上就跳过。
 *   中文没改的内容一条请求都不会发（需求 6.5）。
 *
 *   **不花冤枉钱。** 中文为空的字段根本不进文档；中文被清空的字段只是**清掉译文**，
 *   不需要任何 API 调用（需求 6.3 / 6.9）。
 *
 *   **可中断、可续跑。** 每次调用带一个时间预算，超了就带着进度返回，
 *   调用方（Server Action 或命令行）再来一次即可。因此不存在「一个请求挂 60 秒以上」
 *   （需求 8.6）。
 */

export type LocaleSyncOutcome = 'synced' | 'failed' | 'nothing' | 'pending';

export interface LocaleResult {
  locale: Locale;
  outcome: LocaleSyncOutcome;
  /** 新翻出来的字段数 */
  translated: number;
  /** 因为中文已删而清掉的字段数 */
  cleared: number;
  error?: string;
}

export interface EntitySyncResult {
  ok: boolean;
  entityType: string;
  entityId: string;
  /** 钉住的版本号 —— 本次全部批次都来自这一版中文 */
  revision: number;
  /** 中文相对上次记录是否变了 */
  changed: boolean;
  locales: LocaleResult[];
  requestCount: number;
  tokenEstimate: number;
  /** 时间预算用完，还有内容没处理完；再调用一次继续 */
  hasMore: boolean;
  /** 一个字段都不需要处理（没有可写位置，也没有要清的），**没有产生任何 API 调用** */
  nothingToDo: boolean;
  /** 整体失败的原因（配置缺失、模型不可用等），逐语言的结果仍会照常返回 */
  error?: string;
}

export interface SyncEntityOptions {
  /** 目标语言，默认全部非中文语言 */
  locales?: readonly Locale[];
  /** 只处理上次失败的语言（「只重试失败内容」） */
  onlyFailed?: boolean;
  /** 本次调用的时间预算（毫秒）。默认 25 秒 —— Server Action 与命令行的安全上限。 */
  budgetMs?: number;
  /** 已经钉住的版本号。重试同一次发布时传进来，保证各批次来源一致。 */
  pinnedRevision?: number;
  /**
   * 强制重翻：忽略「已同步」的判断，把所有字段重新生成一遍。
   *
   * 对应的界面入口是同步中心的「重新翻译全部语言」。存在的理由是那条被有意采用的
   * 宽松规则：**本功能上线前就存在的译文、以及回滚后的快照，一律认下来不覆盖**
   * （见 document.ts 的 diffUnits）。那是对的选择 —— 但它会漏掉一种情况：
   * 中文在本功能上线之前改过、旧译文却没跟着改。这时机器判断不出来，
   * 得由人来决定重翻。默认关闭，所以「中文没变就不调用」这条性质不受影响。
   */
  force?: boolean;
}

const DEFAULT_BUDGET_MS = 25_000;

/** 只要有一个语言需要翻，就把它挑出来 */
function localesWithPending(plan: SyncPlan, onlyFailed: boolean, requested: readonly Locale[]): Locale[] {
  return requested.filter((locale) => {
    const pending = plan.pendingByLocale.get(locale) ?? [];
    const cleared = plan.clearedByLocale.get(locale) ?? [];
    if (pending.length === 0 && cleared.length === 0) return false;
    if (!onlyFailed) return true;
    return plan.locales.find((item) => item.locale === locale)?.state === 'failed';
  });
}

/**
 * 同步一条内容的全部（或部分）目标语言。
 *
 * 逐语言独立成败：某一种语言失败不会回退别的语言已经写好的结果
 * （需求 7.6「部分失败时保留成功结果」）。调用方根据 `locales[].outcome`
 * 决定是否算作整体成功。
 */
export async function syncEntity(
  db: PrismaClient,
  settings: TranslationSettings,
  entityType: string,
  entityId: string,
  options: SyncEntityOptions = {},
): Promise<EntitySyncResult | null> {
  const adapter = getAdapter(entityType);
  if (!adapter) return null;

  const requested = options.locales ?? defaultTargets();
  const plan = await planSync(db, entityType, entityId, requested);
  if (!plan) return null;

  /**
   * 强制重翻：把「已同步」的判断全部推翻，本语言的全部字段都当作待翻。
   * 只在显式要求时发生 —— 默认路径仍然一个字段都不多翻。
   */
  if (options.force) {
    for (const locale of requested) {
      if (locale === 'zh') continue;
      plan.pendingByLocale.set(locale, [...plan.document.units]);
      const summary = plan.locales.find((item) => item.locale === locale);
      if (summary) {
        summary.pendingCount = plan.document.units.length;
        summary.state = 'stale';
      }
    }
  }

  const result: EntitySyncResult = {
    ok: true,
    entityType,
    entityId,
    revision: plan.storedRevision,
    changed: plan.changed,
    locales: [],
    requestCount: 0,
    tokenEstimate: 0,
    hasMore: false,
    nothingToDo: true,
  };

  /**
   * 第零步：把「已有译文但没有逐字段记录」的字段认下来。
   *
   * 纯写库，零 API 调用。放在最前面是因为它必须**无条件**发生：不补哈希的话，
   * 这些字段以后中文改了也检测不出差异，会一直停在旧译文上而界面显示已同步。
   * 强制重翻模式下跳过 —— 那种情况下这些字段本来就要重新生成，哈希由
   * recordSuccess 负责写。
   */
  if (!options.force) {
    await adoptUntrackedTranslations(db, entityType, entityId, plan);
  }

  const targets = localesWithPending(plan, options.onlyFailed === true, requested);

  // ---- 第一步：清掉中文已经删掉的字段 ----
  //
  // 这一步**不调用 DeepSeek**：中文清空了，译文跟着清空是纯写库操作。
  // 之所以放在最前面，是因为它无论如何都该发生 —— 即使后面翻译全部失败，
  // 「中文已经删了」这件事也已经同步过了。
  for (const locale of requested) {
    const cleared = plan.clearedByLocale.get(locale) ?? [];
    if (cleared.length === 0) continue;
    await adapter.writeTranslations(db, entityId, locale, {}, cleared);
    await recordCleared(db, {
      entityType,
      entityId,
      locale,
      cleared,
      fieldStates: plan.fieldStatesByLocale.get(locale) ?? {},
    });
    result.locales.push({ locale, outcome: 'nothing', translated: 0, cleared: cleared.length });
  }

  if (targets.length === 0) {
    // 没有要翻的：可能是全部已同步，也可能是中文本来就是空的
    if (result.locales.length === 0) {
      result.locales = requested
        .filter((locale) => locale !== 'zh')
        .map((locale) => ({ locale, outcome: 'nothing', translated: 0, cleared: 0 }));
    }
    return result;
  }

  result.nothingToDo = false;

  if (!settings.apiKey) {
    result.ok = false;
    result.error = 'not-configured';
    for (const locale of targets) {
      result.locales.push({ locale, outcome: 'failed', translated: 0, cleared: 0, error: 'not-configured' });
    }
    return result;
  }

  // ---- 第二步：钉住版本 ----
  //
  // 所有批次都用这一版中文。中途有人改了中文也不会污染本次同步 ——
  // 改过的字段哈希对不上，下一次同步会自己发现（需求 8.5）。
  const revision = options.pinnedRevision ?? (await commitRevision(db, entityType, entityId, plan.hash));
  result.revision = revision;
  await markTranslating(db, entityType, entityId, targets);

  // ---- 第三步：分批翻译 ----
  //
  // 把各语言待翻的单元取并集再切批。一次请求覆盖多个语言，比「一语言一请求」
  // 少一个数量级的调用，也让同一批内容在各语言之间保持一致的语气。
  const union = unionUnits(plan, targets);
  const batches = splitIntoBatches(union);
  const deadline = Date.now() + (options.budgetMs ?? DEFAULT_BUDGET_MS);

  /** 语言 → 路径 → 译文 */
  const collected = new Map<Locale, Record<string, string>>();
  /** 语言 → 实际参与过翻译的路径（用于记录哈希） */
  const touched = new Map<Locale, string[]>();
  /** 语言 → 失败原因 */
  const failed = new Map<Locale, TranslationErrorKind | string>();

  for (const [index, batch] of batches.entries()) {
    // 时间预算用完：带着进度返回，调用方再推进一次
    if (Date.now() > deadline) {
      result.hasMore = true;
      break;
    }

    const keys = new Set(batch.map((unit) => unit.path));
    const batchLocales = targets.filter((locale) =>
      (plan.pendingByLocale.get(locale) ?? []).some((unit) => keys.has(unit.path)),
    );
    if (batchLocales.length === 0) continue;

    const response = await translateUnitBatch(settings, batch, batchLocales);
    result.requestCount += 1;
    result.tokenEstimate += estimateBatchTokens(batch, batchLocales.length);

    if (!response.ok) {
      // 整批失败：本批涉及的语言都记上失败。已经翻好的批次不受影响。
      for (const locale of batchLocales) failed.set(locale, response.error);
      continue;
    }

    for (const locale of batchLocales) {
      const values = response.values[locale];
      if (!values || Object.keys(values).length === 0) {
        failed.set(locale, 'bad-response');
        continue;
      }
      collected.set(locale, { ...(collected.get(locale) ?? {}), ...values });
      touched.set(locale, [...(touched.get(locale) ?? []), ...Object.keys(values)]);
    }

    // 最后一批跑完就没什么可等的了
    if (index === batches.length - 1) break;
  }

  // ---- 第四步：逐语言写回 ----
  //
  // 关键在于每一语言**独立**结算：某一种语言整批失败时，别的语言已经翻好并写库的
  // 结果原样保留。这也是「部分失败时保留成功结果」（需求 7.6）与
  // 「只重试失败内容」（需求 7.7）能成立的前提 —— 失败的那些字段哈希没被记录，
  // 下次同步会自己认出它们还没翻。
  for (const locale of targets) {
    const values = collected.get(locale) ?? {};
    const paths = touched.get(locale) ?? [];
    const pending = plan.pendingByLocale.get(locale) ?? [];

    if (paths.length === 0) {
      // 一个字段都没翻到：是「还没轮到」还是「真的失败了」，取决于预算有没有用完
      if (result.hasMore) {
        result.locales.push({ locale, outcome: 'pending', translated: 0, cleared: 0 });
        continue;
      }
      const reason = failed.get(locale) ?? 'bad-response';
      await recordFailure(db, { entityType, entityId, locale, reason });
      result.locales.push({ locale, outcome: 'failed', translated: 0, cleared: 0, error: reason });
      continue;
    }

    // 写回只认路径：值写进它自己该在的位置，匹配不上的直接丢弃。
    await adapter.writeTranslations(db, entityId, locale, values, []);
    await recordSuccess(db, {
      entityType,
      entityId,
      locale,
      revision,
      model: settings.model,
      fieldStates: plan.fieldStatesByLocale.get(locale) ?? {},
      translatedPaths: paths,
    });

    // 本语言还有字段没翻出来（模型漏了，或时间不够）时如实说出来，
    // 别让界面显示「全部完成」—— 剩下那些没记哈希，下次同步会接着翻。
    const missed = pending.length - paths.length;
    const reason = failed.get(locale);
    const incomplete = missed > 0 || Boolean(reason);
    result.locales.push({
      locale,
      outcome: incomplete ? 'failed' : 'synced',
      translated: paths.length,
      cleared: 0,
      ...(incomplete ? { error: reason ?? 'incomplete' } : {}),
    });
  }

  return result;
}

/** 各语言待翻单元的并集，按路径排序 —— 顺序稳定，切批结果才可复现（需求 8.3） */
function unionUnits(plan: SyncPlan, targets: readonly Locale[]): TranslationUnit[] {
  const byPath = new Map<string, TranslationUnit>();
  for (const locale of targets) {
    for (const unit of plan.pendingByLocale.get(locale) ?? []) {
      if (!byPath.has(unit.path)) byPath.set(unit.path, unit);
    }
  }
  return [...byPath.values()].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
}

/**
 * 默认的目标语言：除中文以外的全部语言。
 *
 * 从统一语言清单派生，加语言时这里自动跟上。留成函数是为了将来能在后台
 * 配置「只发布哪些语言」而不必改调用方。
 */
function defaultTargets(): Locale[] {
  return targetLocales(locales);
}

/** 本次同步是否整体成功：所有参与的语言都写成功了才算 */
export function isFullySynced(result: EntitySyncResult): boolean {
  return (
    result.ok &&
    !result.hasMore &&
    result.locales.every((item) => item.outcome === 'synced' || item.outcome === 'nothing')
  );
}

/** 失败的语言清单，用于「只重试失败内容」 */
export function failedLocales(result: EntitySyncResult): Locale[] {
  return result.locales.filter((item) => item.outcome === 'failed').map((item) => item.locale);
}
