import type { PreviewChannel } from '@/lib/preview/util';
import { MailIcon, PhoneIcon, WhatsAppIcon } from '@/components/ui/icons';

const ICONS = {
  whatsapp: WhatsAppIcon,
  email: MailIcon,
  phone: PhoneIcon,
} as const;

/**
 * 桌面端常驻联系入口。
 *
 * 与正式站的彩色胶囊按钮不同，这里是一组方角细线按钮：
 * 默认只显示图标，悬停时才展开通道号码，尽量不干扰版面。
 * 仅在桌面端出现 —— 移动端由「全球询盘」区块与页脚承担，避免遮挡正文。
 */
export function PreviewContactRail({ channels }: { channels: PreviewChannel[] }) {
  if (channels.length === 0) return null;

  return (
    <div className="pointer-events-none fixed bottom-6 right-6 z-40 hidden lg:block">
      <ul className="pointer-events-auto flex flex-col items-end gap-2">
        {channels.map((channel) => {
          const Icon = ICONS[channel.key];
          return (
            <li key={channel.key}>
              <a
                href={channel.href}
                {...(channel.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                aria-label={`${channel.label}: ${channel.value}`}
                className="group flex h-11 items-center overflow-hidden border border-[var(--pv-rule)] bg-ivory-50/92 px-3 text-navy-900 backdrop-blur transition-colors duration-500 hover:border-navy-950 hover:bg-navy-950 hover:text-ivory-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-copper-500"
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="max-w-0 overflow-hidden whitespace-nowrap font-mono text-[0.7rem] opacity-0 transition-all duration-500 group-hover:ml-3 group-hover:max-w-[14rem] group-hover:opacity-100 group-focus-visible:ml-3 group-focus-visible:max-w-[14rem] group-focus-visible:opacity-100">
                  {channel.value}
                </span>
              </a>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
