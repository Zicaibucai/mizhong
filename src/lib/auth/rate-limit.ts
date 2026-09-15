/**
 * 基础登录频率限制（进程内滑动窗口）。
 *
 * 说明：当前部署为单机（PM2 + Nginx），进程内计数已能满足「基础频率限制」要求；
 * 多实例部署时应替换为 Redis 等共享存储。
 */
interface Bucket {
  failures: number;
  windowStart: number;
  blockedUntil: number;
}

const WINDOW_MS = 10 * 60 * 1000; // 统计窗口：10 分钟
const MAX_FAILURES = 5; // 窗口内允许的失败次数
const BLOCK_MS = 10 * 60 * 1000; // 触发后封禁时长

const buckets = new Map<string, Bucket>();

function getBucket(key: string): Bucket {
  const now = Date.now();
  const existing = buckets.get(key);
  if (!existing || now - existing.windowStart > WINDOW_MS) {
    const fresh: Bucket = { failures: 0, windowStart: now, blockedUntil: 0 };
    buckets.set(key, fresh);
    return fresh;
  }
  return existing;
}

/** 清理过期条目，避免长时间运行后内存增长 */
function sweep(): void {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (now - bucket.windowStart > WINDOW_MS && bucket.blockedUntil < now) {
      buckets.delete(key);
    }
  }
}

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

export function checkRateLimit(key: string): RateLimitResult {
  sweep();
  const bucket = getBucket(key);
  const now = Date.now();
  if (bucket.blockedUntil > now) {
    return { allowed: false, retryAfterSeconds: Math.ceil((bucket.blockedUntil - now) / 1000) };
  }
  return { allowed: bucket.failures < MAX_FAILURES, retryAfterSeconds: 0 };
}

export function recordFailure(key: string): void {
  const bucket = getBucket(key);
  bucket.failures += 1;
  if (bucket.failures >= MAX_FAILURES) {
    bucket.blockedUntil = Date.now() + BLOCK_MS;
  }
}

export function clearRateLimit(key: string): void {
  buckets.delete(key);
}
