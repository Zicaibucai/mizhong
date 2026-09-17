import type { Locale } from '@/lib/i18n';
import type { ProductMediaView } from '@/lib/catalog';
import { getCatalogDict } from '@/lib/i18n/catalog';
import { cn } from '@/lib/cn';
import { ChevronLeftIcon, ChevronRightIcon, PlayIcon } from '@/components/ui/icons';
import { ZoomableImage } from './zoomable-image';
import { MediaThumbs, type MediaThumb } from './media-thumbs';

/** 缩略图使用的地址：视频优先用封面，图片优先用缩略图 */
function thumbSrc(item: ProductMediaView): string | null {
  if (item.type === 'video') return item.posterUrl ?? item.thumbnailUrl ?? null;
  return item.thumbnailUrl ?? item.url ?? null;
}

function slideId(index: number): string {
  return `pmedia-${index}`;
}

const arrowClass =
  'absolute top-1/2 z-[2] flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-navy-950/55 text-ivory-50 backdrop-blur-sm transition-colors hover:bg-navy-950/85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-copper-500';

/**
 * 产品详情页媒体查看器：主媒体 + 左右切换 + 缩略图，图片与视频可切换。
 *
 * 版面按 1688 的做法：
 *
 * - **视频排第一。** 商品只要配了视频（图库里的 VIDEO 素材，或只设了「悬停视频」），
 *   它就是这个商品的第一个镜头；其余图片保持原有顺序，封面仍在原位。
 * - **取景框固定 1:1，图片一律完整显示。** 图片用 `object-contain` 放进方框，
 *   比例不是 1:1 的图四周留黑边，而不是裁掉两边 —— 「全部显示」优先于「填满方框」。
 * - **左右切换 + 缩略图条。** 两者都是真实的锚点链接，切换靠 globals.css 的 `:target`
 *   规则完成，所以**没有 JavaScript 也能切换**，键盘也能直接操作。
 * - **悬停放大**（`ZoomableImage`）只在桌面精确指针上作为增强出现。
 *
 * 每个媒体都带 `scroll-margin-top`，跳转时不会被吸顶的站点头遮住。
 */
export function ProductMediaViewer({
  locale,
  items,
  hoverVideo,
  fallbackAlt,
  className,
}: {
  locale: Locale;
  items: ProductMediaView[];
  /** 商品的「悬停视频」：图库里没有视频素材时，用它开第一帧 */
  hoverVideo?: { url: string; posterUrl: string | null } | null;
  /** 素材缺少 alt 时使用的替代文本（产品名称） */
  fallbackAlt: string;
  className?: string;
}) {
  const dict = getCatalogDict(locale);

  // 只保留有地址的素材，避免出现打不开的空幻灯片
  const usable = items.filter((item) => Boolean(item.url));
  const hoverVideoUrl = hoverVideo?.url ?? null;

  const slides: ProductMediaView[] = (() => {
    const videoIndex = usable.findIndex((item) => item.type === 'video');

    if (videoIndex < 0) {
      if (!hoverVideoUrl) return usable;
      // 只设了悬停视频、图库里没有视频素材的商品，同样以视频开场
      return [
        {
          id: 'hover-video',
          assetId: 'hover-video',
          type: 'video',
          url: hoverVideoUrl,
          thumbnailUrl: hoverVideo?.posterUrl ?? null,
          posterUrl: hoverVideo?.posterUrl ?? null,
          alt: '',
          caption: null,
        },
        ...usable,
      ];
    }

    if (videoIndex === 0) return usable;
    // 把第一个视频提到最前，其余保持原有顺序（封面仍在自己的位置上）
    const video = usable[videoIndex];
    return [video, ...usable.slice(0, videoIndex), ...usable.slice(videoIndex + 1)];
  })();

  if (slides.length === 0) return null;

  const thumbs: MediaThumb[] = slides.map((item, index) => ({
    id: slideId(index),
    src: thumbSrc(item),
    label: `${item.type === 'video' ? dict.detail.videoLabel : dict.detail.imageLabel} ${index + 1}`,
    isVideo: item.type === 'video',
  }));

  const step = (index: number, delta: number) =>
    slideId((index + delta + slides.length) % slides.length);

  return (
    <div className={className}>
      <div className="media-stage">
        {slides.map((item, index) => {
          const label = item.alt.trim() || fallbackAlt;
          const poster = item.posterUrl?.trim() || undefined;

          return (
            <div
              key={item.id}
              id={slideId(index)}
              className="media-slide scroll-mt-28"
              role="group"
              aria-label={`${index + 1} / ${slides.length}`}
            >
              {/* 外框负责描边，内框负责比例：这样取景框的矩形与图片的绘制矩形完全重合 */}
              <div className="border border-navy-200/80">
                <div className="relative aspect-square w-full overflow-hidden bg-navy-950">
                  {item.type === 'video' && item.url ? (
                    <video
                      className="absolute inset-0 h-full w-full object-contain"
                      controls
                      preload="metadata"
                      poster={poster}
                      aria-label={label}
                    >
                      <source src={item.url} />
                    </video>
                  ) : item.url ? (
                    <ZoomableImage
                      src={item.url}
                      alt={label}
                      eager={index === 0}
                      hint={dict.detail.zoomHint}
                    />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center">
                      <PlayIcon className="h-8 w-8 text-navy-500" />
                    </span>
                  )}

                  {slides.length > 1 ? (
                    <>
                      <a
                        href={`#${step(index, -1)}`}
                        aria-label={dict.detail.mediaPrev}
                        className={cn(arrowClass, 'left-3')}
                      >
                        <ChevronLeftIcon className="h-5 w-5" />
                      </a>
                      <a
                        href={`#${step(index, 1)}`}
                        aria-label={dict.detail.mediaNext}
                        className={cn(arrowClass, 'right-3')}
                      >
                        <ChevronRightIcon className="h-5 w-5" />
                      </a>
                    </>
                  ) : null}
                </div>
              </div>

              {item.caption ? (
                <p className="mt-3 text-sm leading-relaxed text-muted">{item.caption}</p>
              ) : null}
            </div>
          );
        })}
      </div>

      <MediaThumbs thumbs={thumbs} label={dict.detail.mediaThumbnails} />
    </div>
  );
}

/** 规格参数表：只渲染有值的行，空行由数据层过滤掉 */
export function ProductSpecTable({
  specs,
  caption,
  className,
}: {
  specs: { id: string; name: string; value: string }[];
  caption?: string;
  className?: string;
}) {
  if (specs.length === 0) return null;

  return (
    <table className={cn('w-full border-collapse border-t border-navy-200 text-left text-sm', className)}>
      {caption ? <caption className="sr-only">{caption}</caption> : null}
      <tbody className="divide-y divide-navy-200">
        {specs.map((spec) => (
          <tr key={spec.id} className="align-top">
            <th
              scope="row"
              className="w-2/5 py-3 pr-4 font-medium text-navy-600 sm:w-1/3"
            >
              {spec.name}
            </th>
            <td className="py-3 text-navy-900">{spec.value || '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** 可配置规格/颜色表：桌面完整展示，窄屏允许横向滚动而不挤压单元格。 */
export function ProductVariantTable({
  table,
  caption,
  className,
}: {
  table: {
    columns: { id: string; label: string }[];
    rows: { id: string; cells: Record<string, string> }[];
  };
  caption?: string;
  className?: string;
}) {
  if (table.columns.length === 0 || table.rows.length === 0) return null;

  return (
    <div className={cn('overflow-x-auto border-t border-navy-200', className)}>
      <table className="min-w-[640px] w-full border-collapse text-left text-sm">
        {caption ? <caption className="sr-only">{caption}</caption> : null}
        <thead className="border-b border-navy-200 bg-ivory-100/70">
          <tr>
            {table.columns.map((column) => (
              <th key={column.id} scope="col" className="px-4 py-3 font-medium text-navy-700">
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-navy-200">
          {table.rows.map((row) => (
            <tr key={row.id} className="align-top">
              {table.columns.map((column) => (
                <td key={column.id} className="px-4 py-3 text-navy-900">
                  {row.cells[column.id] || '—'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
