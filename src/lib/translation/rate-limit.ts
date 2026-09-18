/**
 * 翻译接口的限流与并发限制。
 *
 * 存在的理由很实际：翻译是**按量计费**的。一次误操作（连点、卡住后重试、
 * 或者账号被盗）就能在几分钟里烧掉相当可观的费用。所以这里挡两道：
 *
 *   1. **并发上限** —— 同一时刻最多几个翻译请求在飞。防止「连点 20 次」把
 *      20 个请求同时打到 DeepSeek 上；
 *   2. **按管理员限流** —— 每个管理员在一个时间窗内最多发起几次。防止有人
 *      （或脚本）持续刷。
 *
 * 计数放在**进程内存**里。当前部署是 pm2 fork 模式、单实例，
 * 所以进程内存就是全局状态，足够准确。如果将来改成多实例（cluster / 多机），
 * 这里要换成 Redis 或数据库计数 —— 换成多实例时请一并改掉，
 * 否则每个实例各自计数，实际上限会变成「实例数 × 配置值」。
 */

/** 同一时刻允许在飞的翻译请求数 */
export const MAX_CONCURRENT_TRANSLATIONS = 2;

/** 单个管理员在窗口内允许发起的次数 */
export const ADMIN_RATE_LIMIT = 10;

/** 限流窗口（毫秒） */
export const ADMIN_RATE_WINDOW_MS = 60_000;

export type RateLimitResult =
  | { ok: true; release: () => void }
  | { ok: false; reason: 'concurrency' | 'rate'; retryAfterMs: number };

/** 当前在飞的请求数 */
let inFlight = 0;

/** 管理员 id → 窗口内的调用时间戳 */
const history = new Map<string, number[]>();

/** 只保留窗口内的记录，顺便清掉已经没有任何记录的管理员，避免 Map 无限增长 */
function prune(now: number, key: string): number[] {
  const kept = (history.get(key) ?? []).filter((at) => now - at < ADMIN_RATE_WINDOW_MS);
  if (kept.length === 0) history.delete(key);
  else history.set(key, kept);
  return kept;
}

/**
 * 申请一次翻译额度。
 *
 * 成功时返回 `release()`，**调用方必须在校验过的 finally 里调用它**，
 * 否则并发计数只增不减，最终会把翻译彻底锁死。
 */
export function acquireTranslationSlot(adminId: string): RateLimitResult {
  const now = Date.now();

  if (inFlight >= MAX_CONCURRENT_TRANSLATIONS) {
    return { ok: false, reason: 'concurrency', retryAfterMs: 2_000 };
  }

  const recent = prune(now, adminId);
  if (recent.length >= ADMIN_RATE_LIMIT) {
    const oldest = recent[0];
    return {
      ok: false,
      reason: 'rate',
      retryAfterMs: Math.max(1_000, ADMIN_RATE_WINDOW_MS - (now - oldest)),
    };
  }

  inFlight += 1;
  history.set(adminId, [...recent, now]);

  let released = false;
  return {
    ok: true,
    release: () => {
      // 幂等：重复调用不会把计数减成负数
      if (released) return;
      released = true;
      inFlight = Math.max(0, inFlight - 1);
    },
  };
}

/** 仅供测试：重置全部计数 */
export function resetRateLimiter(): void {
  inFlight = 0;
  history.clear();
}

/** 仅供测试/诊断：当前在飞数 */
export function currentInFlight(): number {
  return inFlight;
}
