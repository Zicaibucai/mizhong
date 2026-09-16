import { createReadStream, createWriteStream } from 'node:fs';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { randomBytes } from 'node:crypto';
import { MEDIA_PUBLIC_BASE, UPLOAD_DIR, resolveInsideUploadDir } from './shared';

/** 在系统临时目录创建临时文件（上传期间使用，随后移入上传目录） */
export async function createTempFile(): Promise<{ filePath: string; stream: NodeJS.WritableStream }> {
  const dir = path.join(os.tmpdir(), 'mizhong-upload');
  await fs.mkdir(dir, { recursive: true });
  const filePath = path.join(dir, `${randomBytes(12).toString('hex')}.part`);
  return { filePath, stream: createWriteStream(filePath) };
}

/**
 * 把请求体流式写入磁盘，超过 maxBytes 立即中断并清理。
 * 全程不把大文件读进内存。
 */
export async function streamToTempFile(
  body: ReadableStream<Uint8Array>,
  filePath: string,
  maxBytes: number,
): Promise<{ size: number } | { error: 'too_large' }> {
  const nodeStream = Readable.fromWeb(body as Parameters<typeof Readable.fromWeb>[0]);
  let size = 0;
  let exceeded = false;

  const counter = new (await import('node:stream')).Transform({
    transform(chunk, _enc, callback) {
      size += chunk.length;
      if (size > maxBytes) {
        exceeded = true;
        callback(new Error('TOO_LARGE'));
        return;
      }
      callback(null, chunk);
    },
  });

  try {
    await pipeline(nodeStream, counter, createWriteStream(filePath));
  } catch (error) {
    await fs.rm(filePath, { force: true });
    if (exceeded) return { error: 'too_large' };
    throw error;
  }

  return { size };
}

/** 读取文件头部若干字节用于类型嗅探 */
export async function readHead(filePath: string, bytes = 32): Promise<Buffer> {
  const handle = await fs.open(filePath, 'r');
  try {
    const buffer = Buffer.alloc(bytes);
    const { bytesRead } = await handle.read(buffer, 0, bytes, 0);
    return buffer.subarray(0, bytesRead);
  } finally {
    await handle.close();
  }
}

export function publicUrlFor(key: string): string {
  return `${MEDIA_PUBLIC_BASE.replace(/\/$/, '')}/${key}`;
}

/**
 * 把临时文件移动到上传目录。
 * 同一文件系统内 rename 是原子的；跨文件系统时回退为复制后删除。
 */
export async function commitTempFile(tempFilePath: string, key: string): Promise<number> {
  const destination = resolveInsideUploadDir(key);
  if (!destination) throw new Error('非法的对象 key');

  await fs.mkdir(path.dirname(destination), { recursive: true });
  try {
    await fs.rename(tempFilePath, destination);
  } catch {
    await pipeline(createReadStream(tempFilePath), createWriteStream(destination));
    await fs.rm(tempFilePath, { force: true });
  }

  const stat = await fs.stat(destination);
  return stat.size;
}

export async function removeObject(key: string): Promise<void> {
  const target = resolveInsideUploadDir(key);
  if (!target) return;
  await fs.rm(target, { force: true });
}

export async function objectExists(key: string): Promise<boolean> {
  const target = resolveInsideUploadDir(key);
  if (!target) return false;
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

export { UPLOAD_DIR };
