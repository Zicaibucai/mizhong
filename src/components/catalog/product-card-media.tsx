'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/cn';

/**
 * 产品卡片的「悬停视频」行为。
 *
 * 设计约束（与验收条款一一对应）：
 * - 只在**真正支持 hover 的精确指针设备**上生效；触屏、平板与
 *   `prefers-reduced-motion` 用户完全不产生任何视频请求，始终看到封面图；
 * - 视频地址在**首次悬停时**才写入元素（`preload="none"` —— 首屏不会加载任何视频字节），
 *   这是比 `preload="metadata"` 更克制的加载策略；
 * - `muted` / `loop` / `playsInline` / 无 `controls`：静音、循环、移动端内联，绝不自动出声；
 * - 鼠标离开后暂停并回到开头；
 * - 播放被浏览器拒绝或解码失败时立刻回退封面图；
 * - hover 只是视觉增强：产品名称、价格、MOQ 等关键信息全都在 `<video>` 之外的 DOM 里，
 *   键盘与无 JavaScript 用户看到的信息完全一致。
 *
 * 挂载位置说明：鼠标事件挂在**整张卡片**上，而不是只挂在图片容器上。
 * 原因是卡片的「拉伸链接」（`after:absolute after:inset-0`）覆盖了包括图片在内的整个卡片，
 * 指针事件会被它先接住 —— 只挂在图片容器上时 mouseenter 永远不会触发（实测确认）。
 * 因此在卡片上监听是本设计下唯一可靠的做法，且悬停整个卡片都播放视频对用户更宽容。
 */
export function useHoverVideo(hoverVideoUrl: string | null) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [videoFailed, setVideoFailed] = useState(false);
  const [canHover, setCanHover] = useState(false);

  // 能力探测放在 effect 里：服务端渲染与首帧始终保持封面，避免 hydration 不一致
  useEffect(() => {
    if (!hoverVideoUrl) return;
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;

    const hoverQuery = window.matchMedia('(hover: hover) and (pointer: fine)');
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => {
      const allowed = hoverQuery.matches && !motionQuery.matches;
      setCanHover(allowed);
      if (!allowed) videoRef.current?.pause();
    };

    sync();
    hoverQuery.addEventListener('change', sync);
    motionQuery.addEventListener('change', sync);
    return () => {
      hoverQuery.removeEventListener('change', sync);
      motionQuery.removeEventListener('change', sync);
    };
  }, [hoverVideoUrl]);

  const play = useCallback(() => {
    const video = videoRef.current;
    if (!video || videoFailed || !hoverVideoUrl) return;
    // 首次悬停才真正开始加载，避免列表页为不可见的视频付出带宽
    if (!video.getAttribute('src')) video.setAttribute('src', hoverVideoUrl);

    // play() 返回 Promise。**只有真正的失败才回退封面**：
    // 鼠标很快移开时 pause() 会打断尚未完成的 play()，浏览器以 AbortError 拒绝该 Promise。
    // 那是正常交互（快速划过卡片），若把它当成解码失败就会永久关掉这一票卡片的悬停视频。
    const started = video.play();
    if (started && typeof started.catch === 'function') {
      started.catch((error: unknown) => {
        const name = error instanceof Error ? error.name : '';
        if (name === 'AbortError' || name === 'NotAllowedError') return;
        setVideoFailed(true);
      });
    }
  }, [hoverVideoUrl, videoFailed]);

  const stop = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.pause();
    // 回到开头：下次悬停从头播放，而不是接着上次的进度
    try {
      video.currentTime = 0;
    } catch {
      // 元数据尚未加载完成时设置 currentTime 会抛错，忽略即可
    }
  }, []);

  const hasVideo = Boolean(hoverVideoUrl) && !videoFailed;

  return {
    /** 是否应该渲染并允许播放视频 */
    enabled: canHover && hasVideo,
    videoRef,
    onError: () => setVideoFailed(true),
    /** 挂到卡片根元素上 */
    handlers: {
      onMouseEnter: canHover && hasVideo ? play : undefined,
      onMouseLeave: canHover && hasVideo ? stop : undefined,
    },
  };
}

export type HoverVideo = ReturnType<typeof useHoverVideo>;

/**
 * 产品卡片的封面图 + 悬停视频图层。
 *
 * 视频的显示/隐藏交给 CSS（`group-hover` + `motion-safe`），因此
 * 关闭 JavaScript、`prefers-reduced-motion` 或视频加载失败时，封面图始终可见。
 */
export function ProductCardMedia({
  coverUrl,
  coverAlt,
  hoverVideoPosterUrl,
  hover,
  placeholder,
  className,
}: {
  coverUrl: string | null;
  coverAlt: string;
  hoverVideoPosterUrl: string | null;
  hover: HoverVideo;
  /** 没有封面图时由调用方传入的占位元素（保持服务端渲染） */
  placeholder: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('relative overflow-hidden bg-navy-100', className)}>
      {coverUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- 素材来自 OSS 动态域名，接入 next/image remotePatterns 后统一替换
        <img
          src={coverUrl}
          alt={coverAlt}
          loading="lazy"
          className={cn(
            'aspect-[4/3] w-full border border-navy-200/80 object-cover transition-transform duration-700 motion-safe:group-hover:scale-[1.035]',
            hover.enabled ? 'motion-safe:group-hover:opacity-0' : null,
          )}
        />
      ) : (
        placeholder
      )}

      {hover.enabled ? (
        <video
          ref={hover.videoRef}
          poster={hoverVideoPosterUrl ?? coverUrl ?? undefined}
          muted
          loop
          playsInline
          preload="none"
          disablePictureInPicture
          aria-hidden="true"
          tabIndex={-1}
          onError={hover.onError}
          className="pointer-events-none absolute inset-0 h-full w-full border border-navy-200/80 bg-navy-950 object-cover opacity-0 transition-opacity duration-300 motion-safe:group-hover:opacity-100"
        />
      ) : null}
    </div>
  );
}
