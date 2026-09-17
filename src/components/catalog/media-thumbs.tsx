'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/cn';
import { PlayIcon } from '@/components/ui/icons';

export interface MediaThumb {
  /** 也是对应幻灯片的锚点 id（`#pmedia-0`…） */
  id: string;
  src: string | null;
  label: string;
  isVideo: boolean;
}

/**
 * 详情页的缩略图条。
 *
 * 缩略图本身是**纯锚点链接**（`#pmedia-N`），切换由 globals.css 的 `:target` 规则完成 ——
 * 因此没有 JavaScript 也能切换，键盘可以直接 Tab 到缩略图并回车。
 *
 * 这个组件只补一件事：**把当前这一张高亮出来**。当前项从 `location.hash` 读取，
 * 与 CSS 用的是同一个事实来源，不可能出现「高亮的是 A、显示的是 B」。
 * 挂载前 `active` 为 `null`：不确定时不标记，而不是标错。
 */
export function MediaThumbs({ thumbs, label }: { thumbs: MediaThumb[]; label: string }) {
  const [active, setActive] = useState<number | null>(null);

  useEffect(() => {
    const read = () => {
      const hash = window.location.hash.replace(/^#/, '');
      const found = thumbs.findIndex((thumb) => thumb.id === hash);
      setActive(found >= 0 ? found : 0);
    };

    read();
    window.addEventListener('hashchange', read);
    return () => window.removeEventListener('hashchange', read);
  }, [thumbs]);

  if (thumbs.length < 2) return null;

  return (
    <ul aria-label={label} className="mt-4 flex gap-3 overflow-x-auto pb-1">
      {thumbs.map((thumb, index) => {
        const current = active === index;
        return (
          <li key={thumb.id} className="shrink-0">
            <a
              href={`#${thumb.id}`}
              aria-label={thumb.label}
              aria-current={current ? 'true' : undefined}
              className={cn(
                'group relative block h-20 w-20 overflow-hidden border bg-navy-50 transition-colors',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-copper-500',
                current
                  ? 'border-copper-500 ring-1 ring-copper-500'
                  : 'border-navy-200 hover:border-copper-500',
              )}
            >
              {thumb.src ? (
                // eslint-disable-next-line @next/next/no-img-element -- 素材来自 OSS 动态域名，接入 next/image remotePatterns 后统一替换
                <img src={thumb.src} alt="" loading="lazy" className="h-full w-full object-cover" />
              ) : (
                <span className="flex h-full w-full items-center justify-center">
                  <PlayIcon className="h-5 w-5 text-navy-500" />
                </span>
              )}
              {thumb.isVideo ? (
                <span className="absolute inset-0 flex items-center justify-center bg-navy-950/35">
                  <PlayIcon className="h-5 w-5 text-ivory-50" />
                </span>
              ) : null}
            </a>
          </li>
        );
      })}
    </ul>
  );
}
