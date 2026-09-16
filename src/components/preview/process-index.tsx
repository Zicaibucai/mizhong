'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/cn';
import { ordinal } from '@/lib/preview/util';

/**
 * 采购流程的 sticky 索引。
 *
 * 右侧的四个阶段面板由服务器组件渲染（内含异步的媒体位），
 * 这里只通过 IntersectionObserver 观察它们，并把「当前阶段」写回 DOM：
 *   - 给自己这一列加上 data-active
 *   - 给对应面板加上 data-active（面板本身仍是服务器组件）
 *
 * 检测带收窄到视口中线附近（-45% / -45%），因此永远是「越过屏幕中线的那一阶段」高亮。
 */
export function ProcessIndex({ stages, label }: { stages: string[]; label: string }) {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const panels = Array.from(
      document.querySelectorAll<HTMLElement>('[data-stage-panel]'),
    );
    if (panels.length === 0 || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const element = entry.target as HTMLElement;
          const index = Number(element.dataset.stageIndex ?? '0');
          element.dataset.active = entry.isIntersecting ? 'true' : 'false';
          if (entry.isIntersecting) setActive(index);
        }
      },
      { rootMargin: '-45% 0px -45% 0px', threshold: 0 },
    );

    for (const panel of panels) observer.observe(panel);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="hidden lg:block">
      <div className="lg:sticky lg:top-28">
        <p className="pv-mono text-[0.6rem] text-copper-300">{label}</p>

        <ol className="mt-7 space-y-6">
          {stages.map((stage, i) => (
            <li
              key={stage}
              data-active={i === active}
              className="pv-stage flex items-stretch gap-4"
            >
              <span className="pv-stage-bar w-px shrink-0 bg-copper-400" aria-hidden="true" />
              <span className="pv-num pv-mono pt-0.5 text-[0.6rem] text-navy-300">
                {ordinal(i)}
              </span>
              <span
                className={cn(
                  'text-[0.95rem] leading-snug transition-colors',
                  i === active ? 'text-ivory-50' : 'text-navy-200',
                )}
              >
                {stage}
              </span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
