import type { ReactNode } from 'react';
import type { PreviewChannel } from '@/lib/preview/util';

/**
 * 一个联系渠道的渲染外壳。
 *
 * 有些联系方式**点不了**：微信号（`Sofa_Materials_Mia`）只能复制，
 * 地址也只能看。以前这类内容被整条丢掉 —— 后台填了微信，前台永远不显示。
 *
 * 所以这里按有没有链接决定渲染成 `<a>` 还是 `<span>`，其余完全一致：
 * 同样的 class、同样的无障碍标签、同样的内容。三处渲染点（页脚、侧边联系轨道、
 * 询盘区）共用这一个，将来加类型不会再漏掉某一处。
 *
 * 刻意**不**用「没有链接就给个 `href="#"`」那种做法：点下去什么都不发生的链接
 * 比不显示更糟，而且会被读屏软件当成真的有得点。
 */
export function ChannelLink({
  channel,
  className,
  children,
}: {
  channel: PreviewChannel;
  className?: string;
  children: ReactNode;
}) {
  const label = `${channel.label}: ${channel.value}`;

  if (!channel.href) {
    return (
      <span className={className} aria-label={label}>
        {children}
      </span>
    );
  }

  return (
    <a
      href={channel.href}
      {...(channel.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      aria-label={label}
      className={className}
    >
      {children}
    </a>
  );
}
