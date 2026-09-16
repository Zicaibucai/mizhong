import { ArrowRightIcon } from '@/components/ui/icons';
import { cn } from '@/lib/cn';
import { ordinal } from '@/lib/preview/util';
import type { PreviewChannel } from '@/lib/preview/util';
import { PreviewContainer, SectionHead } from '../shell';

/**
 * 全球询盘：把 WhatsApp / Email / Phone 放到版面上最醒目的位置。
 *
 * 做法不是把按钮做大做亮，而是让整行反白 —— 悬停时深底换成象牙白、
 * 文字翻成深色，通道本身成为版面的主角，而不是一个「联系按钮」。
 *
 * 数据来自内容层（后台可管理），缺失时回退到已确认的公开联系方式。
 */
export function PreviewInquiry({
  index,
  eyebrow,
  title,
  subtitle,
  note,
  channels,
  channelsLabel,
}: {
  index: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  note: string;
  channels: PreviewChannel[];
  channelsLabel: string;
}) {
  return (
    <section id="inquiry" className="texture-weave-dark relative bg-navy-900 py-24 text-ivory-50 lg:py-32">
      <PreviewContainer>
        <SectionHead
          index={index}
          eyebrow={eyebrow}
          title={title}
          subtitle={subtitle}
          tone="dark"
          titleClassName="max-w-3xl"
        />

        <div className="mt-16" data-reveal>
          <p className="pv-mono mb-2 text-[0.58rem] text-navy-300">{channelsLabel}</p>

          <ul>
            {channels.map((channel, i) => (
              <li key={channel.key}>
                <a
                  href={channel.href}
                  {...(channel.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                  aria-label={`${channel.label}: ${channel.value}`}
                  className={cn(
                    'pv-channel pv-channel-light flex flex-col gap-2 border-t border-[var(--pv-rule-dark)] py-7 text-ivory-50',
                    'sm:flex-row sm:items-center sm:justify-between sm:gap-8 lg:py-9',
                  )}
                >
                  <span className="flex items-baseline gap-5">
                    <span className="pv-num pv-mono text-[0.58rem] text-copper-300">
                      {ordinal(i)}
                    </span>
                    <span className="pv-mono text-[0.62rem] text-current opacity-70">
                      {channel.label}
                    </span>
                  </span>

                  <span className="flex min-w-0 items-center gap-6 sm:justify-end">
                    <span className="pv-channel-value pv-display truncate text-[clamp(1.05rem,2.4vw,2rem)] text-current">
                      {channel.value}
                    </span>
                    <ArrowRightIcon className="pv-arrow h-5 w-5 shrink-0 text-current opacity-60" />
                  </span>
                </a>
              </li>
            ))}
          </ul>

          <div className="border-t border-[var(--pv-rule-dark)]" />
        </div>

        {note ? <p className="pv-mono mt-6 text-[0.58rem] text-navy-300">{note}</p> : null}
      </PreviewContainer>
    </section>
  );
}
