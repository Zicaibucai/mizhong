'use client';

import { useCallback, useRef } from 'react';
import { useHoverCapable } from '@/components/catalog/product-card-media';
import { ZoomIcon } from '@/components/ui/icons';

/**
 * 产品主图的「悬停放大」（1688 那种放大镜）。
 *
 * 三条不能违背的规则：
 *
 * 1. **只在图片真正画出来的那块区域里放大。** 主图用 `object-contain` 放进 1:1 的取景框，
 *    比例不是 1:1 的图四周会有黑边。放大层若以整个取景框为基准，黑边也会被一起放大 ——
 *    所以每次都先用 `naturalWidth/naturalHeight` 反算出图片在框内的实际矩形，再以它为基准。
 *
 * 2. **光标下的那个点原地不动。** 位移取 `drawLeft - f * drawW * (ZOOM - 1)`：
 *    放大后光标指着的仍是原来那一处细节（和地图缩放的手感一致），不会「跑掉」。
 *    再把位移夹回「放大图盖满取景框」的范围内，边缘处就不会露出空白。
 *
 * 3. **只是增强，不是唯一入口。** 触屏、`prefers-reduced-motion`、以及没有 JavaScript 时
 *    完全不渲染放大层；图片本身始终是完整显示的，信息一点不少。
 *
 * 性能：光标位置**不写进 React state**。`pointermove` 每秒触发几十次，走 state 会让整棵
 * 媒体树每帧重渲染；这里只改放大层的 style，一帧一次样式写入。放大层在没悬停时是
 * `display:none`，因此不会预解码、不占合成层。
 */
const ZOOM = 2.5;

/** 把 v 夹进 [lo, hi]；区间反向（图比框还窄的极端比例）时取中点，避免出现无解 */
function clamp(v: number, lo: number, hi: number): number {
  if (lo > hi) return (lo + hi) / 2;
  return Math.min(Math.max(v, lo), hi);
}

export function ZoomableImage({
  src,
  alt,
  eager,
  hint,
}: {
  src: string;
  alt: string;
  /** 首屏那一张不懒加载 */
  eager: boolean;
  /** 「悬停放大」提示文案（可访问名称，同时作为角标文字） */
  hint: string;
}) {
  const frameRef = useRef<HTMLDivElement | null>(null);
  const baseRef = useRef<HTMLImageElement | null>(null);
  const layerRef = useRef<HTMLDivElement | null>(null);
  const zoomRef = useRef<HTMLImageElement | null>(null);
  const badgeRef = useRef<HTMLSpanElement | null>(null);
  const canHover = useHoverCapable();

  const track = useCallback((clientX: number, clientY: number) => {
    const frame = frameRef.current;
    const base = baseRef.current;
    const zoom = zoomRef.current;
    if (!frame || !base || !zoom) return;

    const nw = base.naturalWidth;
    const nh = base.naturalHeight;
    if (!nw || !nh) return;

    const box = frame.getBoundingClientRect();
    if (!box.width || !box.height) return;

    // 图片在取景框内实际绘制出来的矩形（`object-contain` 的等比缩放 + 居中）
    const fit = Math.min(box.width / nw, box.height / nh);
    const drawW = nw * fit;
    const drawH = nh * fit;
    const drawLeft = (box.width - drawW) / 2;
    const drawTop = (box.height - drawH) / 2;

    // 光标落在图片自身坐标系的位置（0..1），移出图片时夹回边缘
    const fx = clamp((clientX - box.left - drawLeft) / drawW, 0, 1);
    const fy = clamp((clientY - box.top - drawTop) / drawH, 0, 1);

    const zoomW = drawW * ZOOM;
    const zoomH = drawH * ZOOM;
    const left = clamp(drawLeft - fx * drawW * (ZOOM - 1), box.width - zoomW, 0);
    const top = clamp(drawTop - fy * drawH * (ZOOM - 1), box.height - zoomH, 0);

    zoom.style.width = `${drawW}px`;
    zoom.style.height = `${drawH}px`;
    zoom.style.transform = `translate3d(${left}px, ${top}px, 0) scale(${ZOOM})`;
  }, []);

  const start = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      // 还没解码完就不放大：否则会闪出一个空框
      if (!baseRef.current?.naturalWidth) return;
      track(event.clientX, event.clientY);
      if (layerRef.current) layerRef.current.style.display = 'block';
      if (badgeRef.current) badgeRef.current.style.opacity = '0';
    },
    [track],
  );

  const move = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => track(event.clientX, event.clientY),
    [track],
  );

  const end = useCallback(() => {
    if (layerRef.current) layerRef.current.style.display = 'none';
    if (badgeRef.current) badgeRef.current.style.opacity = '1';
  }, []);

  return (
    <div
      ref={frameRef}
      className="absolute inset-0"
      onPointerEnter={canHover ? start : undefined}
      onPointerMove={canHover ? move : undefined}
      onPointerLeave={canHover ? end : undefined}
    >
      {/* 基准图：完整显示，多出来的部分就是取景框的黑边 */}
      {/* eslint-disable-next-line @next/next/no-img-element -- 素材来自 OSS 动态域名，接入 next/image remotePatterns 后统一替换 */}
      <img
        ref={baseRef}
        src={src}
        alt={alt}
        loading={eager ? 'eager' : 'lazy'}
        className="absolute inset-0 h-full w-full object-contain"
      />

      {/* 放大层：只在能用悬停的桌面设备上存在（触屏 / reduced-motion 连这个元素都不渲染，
          省掉一份重复的 <img>）；未悬停时 display:none，所以不预解码、不占合成层 */}
      {canHover ? (
        <div
          ref={layerRef}
          aria-hidden="true"
          style={{ display: 'none' }}
          className="pointer-events-none absolute inset-0 z-[1] overflow-hidden bg-navy-950"
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- 与基准图同一张，浏览器复用已解码的位图 */}
          <img
            ref={zoomRef}
            src={src}
            alt=""
            className="absolute left-0 top-0 origin-top-left will-change-transform"
          />
        </div>
      ) : null}

      {/* 悬停放大是「看不见的功能」，给桌面用户一个角标提示；开始放大后淡出 */}
      {canHover ? (
        <span
          ref={badgeRef}
          className="pointer-events-none absolute bottom-3 start-3 z-[2] inline-flex items-center gap-1.5 bg-navy-950/70 px-2.5 py-1.5 text-[0.68rem] font-medium text-ivory-50 transition-opacity duration-200"
        >
          <ZoomIcon className="h-3.5 w-3.5" />
          {hint}
        </span>
      ) : null}
    </div>
  );
}
