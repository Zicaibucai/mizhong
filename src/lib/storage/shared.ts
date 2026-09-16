import path from 'node:path';
import { randomBytes } from 'node:crypto';

/** 上传根目录：位于 Git 仓库之外，重新部署不会删除素材 */
export const UPLOAD_DIR = process.env.UPLOAD_DIR ?? '/opt/mizhong-data/uploads';

/** 对外访问前缀（由 Nginx 映射到 UPLOAD_DIR） */
export const MEDIA_PUBLIC_BASE = process.env.MEDIA_PUBLIC_BASE ?? '/media';

export const LIMITS = {
  image: 15 * 1024 * 1024, // 15MB
  video: 100 * 1024 * 1024, // 100MB
} as const;

export type MediaKind = 'image' | 'video';

export interface DetectedType {
  kind: MediaKind;
  mimeType: string;
  extension: string;
}

/** 允许的图片格式 */
const IMAGE_TYPES: { mime: string; ext: string; test: (b: Buffer) => boolean }[] = [
  {
    mime: 'image/jpeg',
    ext: 'jpg',
    test: (b) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  },
  {
    mime: 'image/png',
    ext: 'png',
    test: (b) =>
      b.length > 8 &&
      b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  },
  {
    mime: 'image/webp',
    ext: 'webp',
    test: (b) =>
      b.length > 12 && b.subarray(0, 4).toString('ascii') === 'RIFF' && b.subarray(8, 12).toString('ascii') === 'WEBP',
  },
  {
    mime: 'image/avif',
    ext: 'avif',
    test: (b) =>
      b.length > 12 &&
      b.subarray(4, 8).toString('ascii') === 'ftyp' &&
      ['avif', 'avis'].includes(b.subarray(8, 12).toString('ascii')),
  },
];

/** 允许的视频格式 */
const VIDEO_TYPES: { mime: string; ext: string; test: (b: Buffer) => boolean }[] = [
  {
    mime: 'video/mp4',
    ext: 'mp4',
    test: (b) =>
      b.length > 12 &&
      b.subarray(4, 8).toString('ascii') === 'ftyp' &&
      ['isom', 'iso2', 'mp41', 'mp42', 'avc1', 'dash', 'M4V ', 'MSNV'].includes(
        b.subarray(8, 12).toString('ascii'),
      ),
  },
  {
    mime: 'video/webm',
    ext: 'webm',
    test: (b) =>
      b.length > 4 && b.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3])),
  },
];

/**
 * 通过文件头（magic bytes）判定真实类型。
 * 绝不信任浏览器提交的 MIME 或扩展名。
 */
export function detectType(head: Buffer): DetectedType | null {
  for (const entry of IMAGE_TYPES) {
    if (entry.test(head)) return { kind: 'image', mimeType: entry.mime, extension: entry.ext };
  }
  for (const entry of VIDEO_TYPES) {
    if (entry.test(head)) return { kind: 'video', mimeType: entry.mime, extension: entry.ext };
  }
  return null;
}

/** 生成安全随机对象 key，避免路径穿越与同名覆盖 */
export function buildObjectKey(kind: MediaKind, extension: string): string {
  const now = new Date();
  const yyyy = String(now.getUTCFullYear());
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  const token = randomBytes(16).toString('hex');
  return path.posix.join(kind, yyyy, mm, `${token}.${extension}`);
}

/** 把外部传入的 key 解析为上传目录内的绝对路径，越界一律拒绝 */
export function resolveInsideUploadDir(key: string): string | null {
  if (!key || key.includes('\0')) return null;
  const normalized = path.posix.normalize(key.replace(/^\/+/, ''));
  if (normalized.startsWith('..') || path.posix.isAbsolute(normalized)) return null;
  const absolute = path.resolve(UPLOAD_DIR, normalized);
  const root = path.resolve(UPLOAD_DIR);
  if (absolute !== root && !absolute.startsWith(root + path.sep)) return null;
  return absolute;
}
