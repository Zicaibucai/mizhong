import type { PrismaClient } from '@prisma/client';

/**
 * DeepSeek 翻译服务的配置。
 *
 * 存放在 `SiteSetting` 表里（键为 `translation.deepseek`），因此**可以在后台直接修改**；
 * 环境变量作为回退，方便部署时先配好、之后再在界面上调整。
 * 优先级：数据库设置 → 环境变量 → 内置默认值。
 *
 * 安全约定：
 *   - API Key 只存在于服务端。读取配置的函数只在 Server Action / 服务端组件里调用；
 *   - 传给客户端的一律是 `maskApiKey()` 的结果（形如 `sk-…abcd`），绝不发原文；
 *   - 任何日志里都不打印 Key。
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

/** 读取当前生效的翻译配置。数据库里没有（或 Key 为空）时回退到环境变量。 */
export async function loadTranslationSettings(
  db: PrismaClient,
): Promise<TranslationSettings> {
  const env = readEnv();

  try {
    const row = await db.siteSetting.findUnique({ where: { key: TRANSLATION_SETTING_KEY } });
    const stored = (row?.value ?? null) as StoredValue | null;
    const apiKey = asString(stored?.apiKey);

    if (apiKey) {
      return {
        apiKey,
        baseUrl: asString(stored?.baseUrl) || env.baseUrl,
        model: asString(stored?.model) || env.model,
        source: 'database',
      };
    }
  } catch {
    // 读设置失败不应该让整个后台打不开：退回环境变量即可
  }

  return {
    ...env,
    source: env.apiKey ? 'environment' : 'none',
  };
}

/** 保存配置。`apiKey` 为空串时表示「不改动 Key」，只更新地址与模型。 */
export async function saveTranslationSettings(
  db: PrismaClient,
  input: { apiKey?: string; baseUrl: string; model: string },
): Promise<void> {
  const existing = await db.siteSetting.findUnique({ where: { key: TRANSLATION_SETTING_KEY } });
  const stored = (existing?.value ?? null) as StoredValue | null;

  const apiKey = input.apiKey?.trim() ? input.apiKey.trim() : asString(stored?.apiKey);

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
