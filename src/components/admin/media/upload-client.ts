'use client';

/**
 * 素材上传客户端工具。
 *
 * 走 `POST /api/admin/media/upload?name=<文件名>`，请求体是**原始文件字节流**，
 * 因此可以用 XMLHttpRequest 拿到真实的 `upload.onprogress` 百分比。
 * （fetch 无法给出上传进度，这是这里刻意使用 XHR 的唯一原因。）
 *
 * 体积 / 类型常量与 src/lib/storage/shared.ts 的 LIMITS 保持一致，但**不引入**该模块：
 * 它依赖 sharp 与 node 内置模块，不能进客户端包。服务端始终是权威校验方。
 */

export interface UploadedAsset {
  id: string;
  type: 'image' | 'video';
  url: string;
  thumbnailUrl: string | null;
  mimeType: string;
  size: number | null;
  width: number | null;
  height: number | null;
}

export type UploadOutcome =
  | { ok: true; asset: UploadedAsset }
  | { ok: false; code: string };

export const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'] as const;
export const VIDEO_MIME_TYPES = ['video/mp4', 'video/webm'] as const;
export const ACCEPT_ATTRIBUTE = [...IMAGE_MIME_TYPES, ...VIDEO_MIME_TYPES].join(',');
export const IMAGE_MAX_BYTES = 15 * 1024 * 1024;
export const VIDEO_MAX_BYTES = 100 * 1024 * 1024;

/** 本地预检查（仅用于提前提示，服务端会重新嗅探文件头） */
export function precheckFile(file: File): string | null {
  if ((VIDEO_MIME_TYPES as readonly string[]).includes(file.type)) {
    return file.size > VIDEO_MAX_BYTES ? 'TOO_LARGE' : null;
  }
  if ((IMAGE_MIME_TYPES as readonly string[]).includes(file.type)) {
    return file.size > IMAGE_MAX_BYTES ? 'TOO_LARGE' : null;
  }
  return 'UNSUPPORTED_TYPE';
}

export interface UploadHandle {
  promise: Promise<UploadOutcome>;
  abort: () => void;
}

/** 上传单个文件（一次一个，避免大视频互相抢带宽） */
export function uploadMediaFile(
  file: File,
  onProgress?: (percent: number) => void,
): UploadHandle {
  let xhr: XMLHttpRequest | null = null;

  const promise = new Promise<UploadOutcome>((resolve) => {
    let settled = false;
    const finish = (outcome: UploadOutcome) => {
      if (settled) return;
      settled = true;
      resolve(outcome);
    };

    xhr = new XMLHttpRequest();
    xhr.open('POST', `/api/admin/media/upload?name=${encodeURIComponent(file.name)}`);
    // 带上会话 Cookie（路由用 getCurrentUser 鉴权）
    xhr.withCredentials = true;
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');

    xhr.upload.onprogress = (event) => {
      if (!onProgress || !event.lengthComputable || event.total === 0) return;
      onProgress(Math.min(100, Math.round((event.loaded / event.total) * 100)));
    };

    xhr.onload = () => {
      let payload: unknown = null;
      try {
        payload = JSON.parse(xhr?.responseText ?? '');
      } catch {
        payload = null;
      }
      const body = (payload ?? {}) as { error?: string } & Partial<UploadedAsset>;

      if (xhr && xhr.status >= 200 && xhr.status < 300 && body.id && body.url) {
        finish({
          ok: true,
          asset: {
            id: body.id,
            type: body.type === 'video' ? 'video' : 'image',
            url: body.url,
            thumbnailUrl: body.thumbnailUrl ?? null,
            mimeType: body.mimeType ?? file.type,
            size: body.size ?? file.size,
            width: body.width ?? null,
            height: body.height ?? null,
          },
        });
        return;
      }

      finish({ ok: false, code: body.error ?? `HTTP_${xhr?.status ?? 0}` });
    };

    xhr.onerror = () => finish({ ok: false, code: 'UPLOAD_FAILED' });
    xhr.onabort = () => finish({ ok: false, code: 'UPLOAD_FAILED' });
    xhr.send(file);
  });

  return {
    promise,
    abort: () => xhr?.abort(),
  };
}
