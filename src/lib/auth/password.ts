import bcrypt from 'bcryptjs';

const BCRYPT_ROUNDS = 12;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  try {
    return await bcrypt.compare(plain, hash);
  } catch (error) {
    console.error('[auth] password verification failed:', error);
    return false;
  }
}

/**
 * 用于「账号不存在」时仍执行一次哈希比较，避免通过响应时间判断账号是否存在。
 * 惰性生成并缓存，避免在源码中硬编码哈希。
 */
let dummyHash: string | null = null;
export function getDummyHash(): string {
  if (!dummyHash) {
    dummyHash = bcrypt.hashSync('mizhong-placeholder-do-not-use', BCRYPT_ROUNDS);
  }
  return dummyHash;
}
