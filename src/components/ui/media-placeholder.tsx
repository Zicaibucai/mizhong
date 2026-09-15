import { cn } from '@/lib/cn';
import { ImageIcon, PlayIcon } from './icons';

interface MediaPlaceholderProps {
  slot: string;
  kind?: 'image' | 'video';
  label?: string;
  className?: string;
}

/**
 * 媒体占位符：在素材尚未接入后台前，语义化媒体位渲染此占位组件。
 * 不引用任何外部/随机图片 URL，仅使用本地 CSS 纹理与内联 SVG。
 */
export function MediaPlaceholder({ slot, kind = 'image', label, className }: MediaPlaceholderProps) {
  const showSlot = process.env.NODE_ENV !== 'production';

  return (
    <div
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn(
        'texture-weave relative flex w-full items-center justify-center overflow-hidden rounded-xl border border-navy-200/80 bg-ivory-100',
        className,
      )}
    >
      <div className="flex flex-col items-center gap-3 px-6 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full border border-copper-300/60 text-copper-500">
          {kind === 'video' ? (
            <PlayIcon className="h-5 w-5" />
          ) : (
            <ImageIcon className="h-5 w-5" />
          )}
        </span>
        {label ? <span className="text-sm font-medium text-navy-500">{label}</span> : null}
      </div>
      {showSlot ? (
        <span className="absolute bottom-2.5 right-3 font-mono text-[10px] uppercase tracking-wider text-navy-300">
          {kind} · {slot}
        </span>
      ) : null}
    </div>
  );
}
