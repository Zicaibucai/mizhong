import { ArrowRightIcon } from '@/components/ui/icons';
import { cn } from '@/lib/cn';
import { ordinal } from '@/lib/preview/util';
import type { PreviewChannel } from '@/lib/preview/util';
import { PreviewContainer, SectionHead } from '../shell';

/**
 * 全球询盘：把 WhatsApp / Email / Phone 放到版面上最醒目的位置。
 *
 * 这一版把「询盘区必须一眼看全」放在第一位：
 *   主标题、简短说明、三条真实联系渠道、浏览产品按钮、发起询盘按钮
 *   全部在服务器渲染的 HTML 里，且默认就是可见状态 ——
 *   滚动动画只做增强，即使 IntersectionObserver 完全不工作（或被禁用），
 *   这里也不会剩下任何空白。
 *
 * 联系方式来自内容层（后台可管理，只取已启用且有值的项），
 * 缺失时回退到 contact-config.ts 中已确认的公开联系方式。
 */
export function PreviewInquiry({
  index,
  eyebrow,
  title,
  subtitle,
  note,
  channels,
  channelsLabel,
  catalogueHref,
  browseProductsLabel,
  inquiryHref,
  inquiryLabel,
  hint,
}: {
  index: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  note: string;
  channels: PreviewChannel[];
  channelsLabel: string;
  /** 完整产品目录（已带语言前缀） */
  catalogueHref: string;
  browseProductsLabel: string;
  /** 发起询盘：优先生成带主题的邮件链接，其次 WhatsApp */
  inquiryHref: string;
  inquiryLabel: string;
  hint: string;
}) {
  return (
    <section
      id="inquiry"
      className="pv-section texture-weave-dark relative bg-navy-900 text-ivory-50"
    >
      <PreviewContainer>
        <div className="grid grid-cols-12 gap-x-6 gap-y-9">
          {/* 左：主标题 + 说明 + 两个动作按钮 */}
          <div className="col-span-12 lg:col-span-5">
            <SectionHead
              index={index}
              eyebrow={eyebrow}
              title={title}
              subtitle={subtitle}
              tone="dark"
              titleClassName="max-w-xl"
            />

            <div className="mt-7 flex flex-wrap gap-3">
              <a href={inquiryHref} className="pv-btn pv-btn-solid">
                <span>{inquiryLabel}</span>
                <ArrowRightIcon className="pv-arrow h-4 w-4" />
              </a>
              <a href={catalogueHref} className="pv-btn pv-btn-line">
                <span>{browseProductsLabel}</span>
                <ArrowRightIcon className="pv-arrow h-4 w-4" />
              </a>
            </div>

            <p className="pv-mono mt-5 text-[0.55rem] leading-relaxed text-navy-400">{hint}</p>
          </div>

          {/* 右：三条直接触达渠道，整行反白 */}
          <div className="col-span-12 lg:col-span-6 lg:col-start-7">
            <p className="pv-mono mb-1 text-[0.58rem] text-navy-300">{channelsLabel}</p>

            <ul>
              {channels.map((channel, i) => (
                <li key={channel.key}>
                  <a
                    href={channel.href}
                    {...(channel.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                    aria-label={`${channel.label}: ${channel.value}`}
                    className={cn(
                      'pv-channel flex items-center justify-between gap-5 border-t border-[var(--pv-rule-dark)] py-4 text-ivory-50 sm:gap-8',
                    )}
                  >
                    <span className="flex min-w-0 items-baseline gap-4">
                      <span className="pv-num pv-mono text-[0.58rem] text-copper-300">
                        {ordinal(i)}
                      </span>
                      <span className="pv-mono text-[0.6rem] text-current opacity-75">
                        {channel.label}
                      </span>
                    </span>

                    <span className="flex min-w-0 items-center gap-4">
                      <span className="pv-channel-value pv-display truncate text-[clamp(0.95rem,1.9vw,1.5rem)] text-current">
                        {channel.value}
                      </span>
                      <ArrowRightIcon className="pv-arrow h-4 w-4 shrink-0 text-current opacity-60" />
                    </span>
                  </a>
                </li>
              ))}
            </ul>

            <div className="border-t border-[var(--pv-rule-dark)]" />
          </div>
        </div>

        {note ? <p className="pv-mono mt-6 text-[0.55rem] text-navy-400">{note}</p> : null}
      </PreviewContainer>
    </section>
  );
}
