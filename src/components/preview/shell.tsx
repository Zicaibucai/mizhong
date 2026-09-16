import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { cssVars } from '@/lib/preview/util';

/**
 * 预览页版式原子：编辑式栅格容器与区块标题。
 *
 * 正式站使用 max-w-7xl；预览页需要更大的画布与更宽的外边距，
 * 才能撑起「超大排版 + 大量留白」的编辑式版面，因此单独定义容器。
 */

export function PreviewContainer({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('mx-auto w-full max-w-[1560px] px-6 sm:px-10 lg:px-14', className)}>
      {children}
    </div>
  );
}

/** 十二栏编辑式栅格 */
export function PreviewGrid({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('grid grid-cols-12 gap-x-6 gap-y-10', className)}>{children}</div>;
}

interface SectionHeadProps {
  /** 两位序号，如 02 */
  index: string;
  eyebrow: string;
  title: string;
  subtitle?: string;
  /** 标题的分行控制：限制最大宽度，避免长句横贯整行 */
  titleClassName?: string;
  tone?: 'light' | 'dark';
  className?: string;
}

/**
 * 区块标题：序号 + 细线 + 领域标签，然后是超大标题与导语。
 * 标题逐行做遮罩上浮（滚动进入视口后播放一次）。
 */
export function SectionHead({
  index,
  eyebrow,
  title,
  subtitle,
  titleClassName,
  tone = 'light',
  className,
}: SectionHeadProps) {
  const dark = tone === 'dark';
  const lines = title
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  return (
    <div className={className} data-reveal-lines>
      {/* 序号 · 细线 · 领域标签 */}
      <div
        className={cn(
          'flex items-center gap-4',
          dark ? 'text-copper-300' : 'text-copper-700',
        )}
      >
        <span className="pv-num pv-mono" aria-hidden="true">
          {index}
        </span>
        <span
          className="h-px flex-1"
          style={{ backgroundColor: dark ? 'var(--pv-rule-dark)' : 'var(--pv-rule)' }}
        />
        <span className="pv-mono">{eyebrow}</span>
      </div>

      <h2
        className={cn(
          'pv-display mt-8 text-[clamp(1.9rem,4vw,3.4rem)]',
          dark ? 'text-ivory-50' : 'text-navy-950',
          titleClassName,
        )}
      >
        {lines.map((line, i) => (
          <span key={line} className="pv-mask" style={cssVars({ '--pv-delay': `${i * 110}ms` })}>
            <span>{line}</span>
          </span>
        ))}
      </h2>

      {subtitle ? (
        <p
          data-reveal
          className={cn(
            'mt-6 max-w-2xl text-[0.95rem] leading-relaxed',
            dark ? 'text-navy-200' : 'text-muted',
          )}
          style={cssVars({ '--pv-delay': '160ms' })}
        >
          {subtitle}
        </p>
      ) : null}
    </div>
  );
}
