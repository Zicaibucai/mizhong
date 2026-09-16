import { UPLOAD_DIR, type MediaKind } from './shared';
import { localProvider } from './local-provider';
import type { CommitResult, StorageProvider } from './types';

export type { CommitResult, StorageProvider, StorageDriverName } from './types';
export { LIMITS, MEDIA_PUBLIC_BASE, UPLOAD_DIR, buildObjectKey, detectType, resolveInsideUploadDir } from './shared';
export type { DetectedType, MediaKind } from './shared';

/**
 * 阿里云 OSS Provider —— 接口已预留，但**尚未配置**。
 *
 * 目前数据库中的 Asset 只存 key / url / driver，业务层不感知具体存储，
 * 后续接入 OSS 时只需在这里实现 commit/remove 并切换 STORAGE_DRIVER，
 * 数据库结构与后台、前台代码都不需要改动。
 */
const ossProvider: StorageProvider = {
  driver: 'oss',
  async commit(): Promise<CommitResult> {
    throw new Error('OSS storage is not configured yet. Set STORAGE_DRIVER=local.');
  },
  async remove() {
    throw new Error('OSS storage is not configured yet.');
  },
  urlFor() {
    throw new Error('OSS storage is not configured yet.');
  },
  absolutePath() {
    return null;
  },
};

/** 当前启用的存储后端 */
export function getStorage(): StorageProvider {
  const driver = (process.env.STORAGE_DRIVER ?? 'local').toLowerCase();
  return driver === 'oss' ? ossProvider : localProvider;
}

/** 上传目录（供启动自检与运维使用） */
export function uploadRoot(): string {
  return UPLOAD_DIR;
}

export type { MediaKind as StorageMediaKind };
