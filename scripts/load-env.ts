import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * 让部署/运维脚本自动读取项目根目录的 `.env.local`。
 * 已存在的环境变量优先，不会被文件覆盖；文件不存在时静默跳过。
 */
export function loadLocalEnv(): void {
  if (process.env.DATABASE_URL) return;

  const file = resolve(process.cwd(), '.env.local');
  if (!existsSync(file)) return;

  try {
    process.loadEnvFile(file);
  } catch {
    // 忽略：环境变量由外部注入
  }
}
