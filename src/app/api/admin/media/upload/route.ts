import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { writeAudit } from '@/lib/audit';
import { getPrisma } from '@/lib/db';
import { LIMITS, buildObjectKey, detectType, getStorage } from '@/lib/storage';
import { readHead, streamToTempFile } from '@/lib/storage/local';
import path from 'node:path';
import fs from 'node:fs/promises';
import os from 'node:os';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * 素材上传接口。
 *
 * 请求体是**原始文件字节流**（不是 multipart），因此可以边收边写磁盘：
 * 大视频不会一次性读进内存。所有元数据通过查询参数传递。
 *
 * POST /api/admin/media/upload?name=<原始文件名>
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  const db = getPrisma();
  if (!db) {
    return NextResponse.json({ error: 'DB_UNAVAILABLE' }, { status: 503 });
  }

  if (!request.body) {
    return NextResponse.json({ error: 'EMPTY_BODY' }, { status: 400 });
  }

  const url = new URL(request.url);
  const originalName = (url.searchParams.get('name') ?? '').slice(0, 200);

  const tempDir = path.join(os.tmpdir(), 'mizhong-upload');
  await fs.mkdir(tempDir, { recursive: true });
  const tempFile = path.join(tempDir, `incoming-${Date.now()}-${Math.random().toString(36).slice(2)}.part`);

  // 先按「视频上限」接收，识别出是图片后再按图片上限复核
  const staged = await streamToTempFile(request.body, tempFile, LIMITS.video);
  if ('error' in staged) {
    await fs.rm(tempFile, { force: true });
    return NextResponse.json({ error: 'TOO_LARGE' }, { status: 413 });
  }

  try {
    const head = await readHead(tempFile);
    const detected = detectType(head);
    if (!detected) {
      return NextResponse.json({ error: 'UNSUPPORTED_TYPE' }, { status: 415 });
    }

    if (staged.size > LIMITS[detected.kind]) {
      return NextResponse.json({ error: 'TOO_LARGE' }, { status: 413 });
    }

    const key = buildObjectKey(detected.kind, detected.extension);
    const storage = getStorage();
    const committed = await storage.commit(tempFile, key, detected.kind);

    const asset = await db.asset.create({
      data: {
        type: detected.kind === 'video' ? 'VIDEO' : 'IMAGE',
        driver: committed.driver === 'oss' ? 'OSS' : 'LOCAL',
        key: committed.key,
        url: committed.url,
        thumbnailUrl: committed.thumbnailUrl,
        mimeType: detected.mimeType,
        originalName: originalName || null,
        width: committed.width,
        height: committed.height,
        size: committed.size,
        enabled: true,
      },
    });

    await writeAudit({
      userId: user.id,
      actorEmail: user.email,
      action: 'CREATE',
      targetType: 'Asset',
      targetId: asset.id,
      summary: `Uploaded ${detected.kind} ${key}`,
      detail: { key, mimeType: detected.mimeType, size: committed.size },
    });

    return NextResponse.json({
      id: asset.id,
      type: detected.kind,
      url: asset.url,
      thumbnailUrl: asset.thumbnailUrl,
      mimeType: asset.mimeType,
      size: asset.size,
      width: asset.width,
      height: asset.height,
    });
  } catch (error) {
    console.error('[media] upload failed:', error);
    return NextResponse.json({ error: 'UPLOAD_FAILED' }, { status: 500 });
  } finally {
    // 无论成功失败都清理临时文件（成功后它已被 move 走，rm 是幂等的）
    await fs.rm(tempFile, { force: true });
  }
}
