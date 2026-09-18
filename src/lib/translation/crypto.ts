import { createCipheriv, createDecipheriv, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

/**
 * 后台密钥的静态加密（at-rest encryption）。
 *
 * 后台填写的 DeepSeek API Key 一旦落库就是明文，任何能读到数据库的人
 * （备份文件、只读副本、误导出、运维日志）都能直接拿去用。
 * 这里用 AES-256-GCM 把它加密后再存，解密只在服务端的读取路径上发生。
 *
 * 设计要点：
 *   - **密钥来自环境变量** `TRANSLATION_ENCRYPTION_KEY`，不写进数据库、不写进代码库；
 *   - 环境变量可以是任意长度的口令，用 scrypt 派生固定 32 字节的密钥
 *     （直接拿口令当密钥会限制强度，且换口令时无法平滑过渡）；
 *   - 每个密文自带随机 IV，所以同一把 Key 每次加密得到的密文都不同；
 *   - 附带认证标签（GCM），密文被篡改会在解密时直接失败，而不是解出一段垃圾；
 *   - 密文格式带 `v1.` 前缀，因此**能区分「已加密」与「历史遗留的明文」**，
 *     后者会被原样读出并在下次保存时自动加密 —— 不需要一次性停机迁移。
 *
 * 没有配置加密密钥时，**拒绝写入**而不是退回明文存储：
 * 静默降级成明文，等于这个需求从来没生效过。
 */

const PREFIX = 'v1';
const KEY_LENGTH = 32;
const IV_LENGTH = 12;
/** scrypt 的盐：固定值即可 —— 它的作用是防止彩虹表，而不是把不同部署隔开 */
const SALT = 'mizhong.translation.settings.v1';

export const ENCRYPTION_KEY_ENV = 'TRANSLATION_ENCRYPTION_KEY';

/** 读取并派生密钥；未配置时返回 null（调用方据此决定是拒绝写入还是跳过解密） */
function deriveKey(): Buffer | null {
  const secret = (process.env[ENCRYPTION_KEY_ENV] ?? '').trim();
  if (!secret) return null;
  return scryptSync(secret, SALT, KEY_LENGTH);
}

export function isEncryptionConfigured(): boolean {
  return deriveKey() !== null;
}

/** 是否是本模块产出的密文 */
export function isEncrypted(value: string): boolean {
  return value.startsWith(`${PREFIX}.`);
}

export class EncryptionUnavailableError extends Error {
  constructor() {
    super(
      `未配置 ${ENCRYPTION_KEY_ENV}，无法安全地保存密钥。请在服务器环境变量中设置它后重试。`,
    );
    this.name = 'EncryptionUnavailableError';
  }
}

/**
 * 加密一个秘密。返回 `v1.<iv>.<tag>.<ciphertext>`（各段 base64）。
 * 未配置加密密钥时抛错 —— 绝不落明文。
 */
export function encryptSecret(plain: string): string {
  const key = deriveKey();
  if (!key) throw new EncryptionUnavailableError();

  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [PREFIX, iv.toString('base64'), tag.toString('base64'), ciphertext.toString('base64')].join(
    '.',
  );
}

/**
 * 解密。
 *
 * 传入**历史遗留的明文**时原样返回 —— 这样升级过程中不需要一次性迁移脚本，
 * 老值继续可用，下次保存时自然被加密。密文损坏或密钥不对返回 null，
 * 调用方据此当作「没有配置」处理，而不是把半截垃圾当成 Key 发出去。
 */
export function decryptSecret(stored: string): string | null {
  if (!stored) return '';
  if (!isEncrypted(stored)) return stored;

  const key = deriveKey();
  if (!key) return null;

  const parts = stored.split('.');
  if (parts.length !== 4) return null;
  const [, ivB64, tagB64, dataB64] = parts;

  try {
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivB64, 'base64'));
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
    return Buffer.concat([
      decipher.update(Buffer.from(dataB64, 'base64')),
      decipher.final(),
    ]).toString('utf8');
  } catch {
    // 认证失败＝密钥换了或密文被改过。返回 null，不抛错、不打印任何片段。
    return null;
  }
}

/** 常量时间比较，避免用比较耗时去猜密钥（用于诊断脚本，不用于鉴权判定） */
export function secretEquals(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
