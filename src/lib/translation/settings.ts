import type { PrismaClient } from '@prisma/client';
import {
  decryptSecret,
  encryptSecret,
  isEncrypted,
} from './crypto';

/**
 * DeepSeek 翻译服务的配置。
 *
 * 存放在 `SiteSetting` 表里（键为 `translation.deepseek`），因此**可以在后台直接修改**；
 * 环境变量作为回退，方便部署时先配好、之后再在界面上调整。
 * 优先级：数据库设置 → 环境变量 → 内置默认值。
 *
 * 安全约定：
 *   - API Key **加密后存储**（AES-256-GCM，见 crypto.ts），密文密钥来自环境变量；
 *   - 只在服务端解密。读取配置的函数只在 Server Action / 服务端组件里调用；
 *   - 传给客户端的一律是 `maskApiKey()` 的结果（形如 `sk-…abcd`），绝不发原文；
 *   - 任何日志里都不打印 Key，连密文片段也不打印。
 */

export const TRANSLATION_SETTING_KEY = 'translation.deepseek';

export const DEFAULT_DEEPSEEK_BASE_URL = 'https://api.deepseek.com/v1';
export const DEFAULT_DEEPSEEK_MODEL = 'deepseek-chat';

export interface TranslationSettings {
  apiKey: string;
  baseUrl: string;
  model: string;
  /** 配置来自哪里，用于在后台界面提示「当前用的是环境变量还是界面里的值」 */
  source: 'database' | 'environment' | 'none';
  /**
   * 数据库里那把 Key 的存储状态。
   * `encrypted` = 已加密；`plaintext` = 历史遗留的明文（读取时可用，但会在下次保存时自动加密）；
   * `unreadable` = 密文解不开（通常是换了加密密钥），视为「没有配置」而不是拿半截垃圾去发请求。
   */
  keyStorage: 'encrypted' | 'plaintext' | 'unreadable' | null;
}

interface StoredValue {
  apiKey?: unknown;
  baseUrl?: unknown;
  model?: unknown;
}

function readEnv(): { apiKey: string; baseUrl: string; model: string } {
  return {
    apiKey: (process.env.DEEPSEEK_API_KEY ?? '').trim(),
    baseUrl: (process.env.DEEPSEEK_BASE_URL ?? '').trim() || DEFAULT_DEEPSEEK_BASE_URL,
    model: (process.env.DEEPSEEK_MODEL ?? '').trim() || DEFAULT_DEEPSEEK_MODEL,
  };
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * 读取当前生效的翻译配置。数据库里没有（或 Key 为空）时回退到环境变量。
 *
 * 顺带做一件「一次性」的事：如果库里还是历史遗留的**明文** Key，而服务器已经配好了
 * 加密密钥，就把这一行原地加密。这样上线不需要停机迁移脚本，
 * 老值也不会在明文状态下一直留着。
 */
export async function loadTranslationSettings(
  db: PrismaClient,
): Promise<TranslationSettings> {
  const env = readEnv();

  try {
    const row = await db.siteSetting.findUnique({ where: { key: TRANSLATION_SETTING_KEY } });
    const stored = (row?.value ?? null) as StoredValue | null;
    const raw = asString(stored?.apiKey);

    if (raw) {
      const encryptedAtRest = isEncrypted(raw);
      const apiKey = decryptSecret(raw);

      if (apiKey === null) {
        // 密文解不开：当作没配置，避免把解出来的半截垃圾当成 Key 去发请求
        console.error('[translation] stored API key could not be decrypted (encryption key changed?)');
        return { apiKey: '', baseUrl: asString(stored?.baseUrl) || env.baseUrl, model: asString(stored?.model) || env.model, source: 'none', keyStorage: 'unreadable' };
      }

      if (!encryptedAtRest) {
        // 历史遗留明文 → 就地加密。失败不阻断读取（本次仍可用），下次保存会再试。
        try {
          const upgraded = encryptSecret(apiKey);
          await db.siteSetting.update({
            where: { key: TRANSLATION_SETTING_KEY },
            data: { value: { ...(stored as Record<string, unknown>), apiKey: upgraded } },
          });
          console.info('[translation] stored API key was plaintext and has been encrypted');
          return {
            apiKey,
            baseUrl: asString(stored?.baseUrl) || env.baseUrl,
            model: asString(stored?.model) || env.model,
            source: 'database',
            keyStorage: 'encrypted',
          };
        } catch {
          console.warn('[translation] could not encrypt the stored API key; configure TRANSLATION_ENCRYPTION_KEY');
        }
      }

      return {
        apiKey,
        baseUrl: asString(stored?.baseUrl) || env.baseUrl,
        model: asString(stored?.model) || env.model,
        source: 'database',
        keyStorage: encryptedAtRest ? 'encrypted' : 'plaintext',
      };
    }
  } catch {
    // 读设置失败不应该让整个后台打不开：退回环境变量即可
  }

  return {
    ...env,
    source: env.apiKey ? 'environment' : 'none',
    keyStorage: null,
  };
}

/**
 * 保存配置。`apiKey` 为空串时表示「不改动 Key」，只更新地址与模型。
 *
 * 写入的 Key **一定**是加密后的密文；没有配置加密密钥时 `encryptSecret` 会抛错，
 * 由调用方转成给管理员看的提示 —— 绝不退回明文存储。
 */
export async function saveTranslationSettings(
  db: PrismaClient,
  input: { apiKey?: string; baseUrl: string; model: string },
): Promise<void> {
  const existing = await db.siteSetting.findUnique({ where: { key: TRANSLATION_SETTING_KEY } });
  const stored = (existing?.value ?? null) as StoredValue | null;

  // 库里存的可能是密文，也可能是历史遗留明文；两种都要先还原成明文再统一加密
  const current = decryptSecret(asString(stored?.apiKey)) ?? '';
  const apiKey = input.apiKey?.trim()
    ? encryptSecret(input.apiKey.trim())
    : current
      ? encryptSecret(current)
      : '';

  await db.siteSetting.upsert({
    where: { key: TRANSLATION_SETTING_KEY },
    create: {
      key: TRANSLATION_SETTING_KEY,
      value: { apiKey, baseUrl: input.baseUrl, model: input.model },
    },
    update: {
      value: { apiKey, baseUrl: input.baseUrl, model: input.model },
    },
  });
}

/**
 * 给界面看的脱敏 Key。
 *
 * 保留前 3 位与后 4 位，中间一律用圆点 —— 足以让人确认「填的是哪一把」，
 * 又不足以还原。Key 短于 12 位时全部打码，避免本来就短的值被完整暴露。
 */
export function maskApiKey(apiKey: string): string {
  if (!apiKey) return '';
  if (apiKey.length < 12) return '•'.repeat(apiKey.length);
  return `${apiKey.slice(0, 3)}${'•'.repeat(8)}${apiKey.slice(-4)}`;
}
