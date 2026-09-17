'use client';

import { useHoverVideo } from '@/components/catalog/product-card-media';

/**
 * 首页产品墙的图版：真实主图 + 可选的「悬停视频」。
 *
 * 与产品目录卡片共用同一套悬停行为（`useHoverVideo`），因此规则完全一致：
 *   - 只在真正支持 hover 的桌面精确指针设备上播放；触屏与 reduced-motion 用户
 *     永远只看到主图，信息不做任何删减；
 *   - 视频地址在首次悬停时才写入元素（`preload="none"`）—— 首屏不加载任何视频字节；
 *   - muted / loop / playsInline / 无 controls：静音、循环、绝不出声；
 *   - 鼠标离开后暂停并回到开头；
 *   - 播放被拒绝或解码失败时立刻回退主图（视频层淡入失败即不可见，主图始终在下层）。
 *
 * 悬停事件挂在这个媒体容器上而不是整张卡片上：本组件只包住图版，
 * 图注文字在图版之外，因此「鼠标移到图片上才播放」是精确的。
 */
export function PreviewTileMedia({
  coverUrl,
  coverAlt,
  hoverVideoUrl,
  hoverVideoPosterUrl,
  decorativeLabel,
}: {
  coverUrl: string;
  coverAlt: string;
  hoverVideoUrl: string | null;
  hoverVideoPosterUrl: string | null;
  /** 屏幕阅读器说明（仅在渲染生成式图形时使用，主图不需要） */
  decorativeLabel?: string;
}) {
  const hover = useHoverVideo(hoverVideoUrl);

  return (
    <div className="pv-plate-art absolute inset-0" {...hover.handlers}>
      {/* eslint-disable-next-line @next/next/no-img-element -- 素材来自本地/OSS 动态地址，接入 next/image remotePatterns 后统一替换 */}
      <img src={coverUrl} alt={coverAlt} loading="lazy" className="pv-tile-img" />

      {hover.enabled ? (
        <video
          ref={hover.videoRef}
          poster={hoverVideoPosterUrl ?? coverUrl}
          muted
          loop
          playsInline
          preload="none"
          disablePictureInPicture
          aria-hidden="true"
          tabIndex={-1}
          onError={hover.onError}
          className="pv-tile-video"
        />
      ) : null}

      {decorativeLabel ? <span className="sr-only">{decorativeLabel}</span> : null}
    </div>
  );
}
