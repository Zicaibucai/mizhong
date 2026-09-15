import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { __mizhongPrisma?: PrismaClient };

/** 是否已配置数据库连接串 */
export function isDbConfigured(): boolean {
  return typeof process.env.DATABASE_URL === 'string' && process.env.DATABASE_URL.length > 0;
}

function createPrismaClient(): PrismaClient {
  return new PrismaClient({
    log: process.env.NODE_ENV === 'production' ? ['error'] : ['error', 'warn'],
  });
}

export function getPrisma(): PrismaClient | null {
  if (!isDbConfigured()) return null;
  if (!globalForPrisma.__mizhongPrisma) {
    try {
      globalForPrisma.__mizhongPrisma = createPrismaClient();
    } catch (error) {
      console.error('[db] failed to initialize PrismaClient:', error);
      return null;
    }
  }
  return globalForPrisma.__mizhongPrisma;
}

/**
 * 安全查询：数据库未配置或查询失败时返回 null，调用方回退到内置字典。
 * 服务端保留可诊断日志，前台不因数据库问题崩溃。
 */
export async function tryDb<T>(fn: (db: PrismaClient) => Promise<T>): Promise<T | null> {
  const db = getPrisma();
  if (!db) return null;
  try {
    return await fn(db);
  } catch (error) {
    console.error('[db] query failed:', error);
    return null;
  }
}
