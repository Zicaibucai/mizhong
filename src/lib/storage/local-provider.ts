import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import {
  MEDIA_PUBLIC_BASE,
  UPLOAD_DIR,
  resolveInsideUploadDir,
  type MediaKind,
} from './shared';
import { commitTempFile, removeObject } from './local';
import type { CommitResult, StorageProvider } from './types';

/** 缩略图最大边长 */
const THUMBNAIL_MAX = 640;

function thumbnailKeyFor(key: string): string {
  const parsed = path.posix.parse(key);
  return path.posix.join('thumb', parsed.dir, `${parsed.name}.webp`);
}

export function publicUrlFor(key: string): string {
  return `${MEDIA_PUBLIC_BASE.replace(/\/$/, '')}/${key.replace(/^\/+/, '')}`;
}

export const localProvider: StorageProvider = {
  driver: 'local',

  async commit(tempFilePath, key, kind: MediaKind): Promise<CommitResult> {
    let width: number | null = null;
    let height: number | null = null;
    let thumbnailUrl: string | null = null;

    // 图片：先读尺寸并生成缩略图（仍在临时文件阶段），再提交原图
    if (kind === 'image') {
      try {
        const metadata = await sharp(tempFilePath).metadata();
        width = metadata.width ?? null;
        height = metadata.height ?? null;

        const thumbKey = thumbnailKeyFor(key);
        const thumbPath = resolveInsideUploadDir(thumbKey);
        if (thumbPath) {
          await fs.mkdir(path.dirname(thumbPath), { recursive: true });
          await sharp(tempFilePath)
            .rotate()
            .resize({ width: THUMBNAIL_MAX, height: THUMBNAIL_MAX, fit: 'inside', withoutEnlargement: true })
            .webp({ quality: 80 })
            .toFile(thumbPath);
          thumbnailUrl = publicUrlFor(thumbKey);
        }
      } catch (error) {
        // 图片处理失败不阻断上传：保留原图，缩略图留空
        console.error('[storage] image processing failed:', error);
      }
    }

    const size = await commitTempFile(tempFilePath, key);

    return {
      driver: 'local',
      key,
      url: publicUrlFor(key),
      size,
      width,
      height,
      thumbnailUrl,
    };
  },

  async remove(key) {
    if (!key) return;
    await removeObject(key);
    await removeObject(thumbnailKeyFor(key));
  },

  urlFor: publicUrlFor,

  absolutePath(key) {
    return resolveInsideUploadDir(key);
  },
};

export { UPLOAD_DIR, MEDIA_PUBLIC_BASE };
