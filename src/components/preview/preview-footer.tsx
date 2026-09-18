import Link from 'next/link';
import type { ReactNode } from 'react';
import { locales, localeNames, type Locale } from '@/lib/i18n';
import type { NavView } from '@/lib/content';
import { ChannelLink } from './channel-link';
import type { PreviewChannel } from '@/lib/preview/util';
import { PreviewContainer } from './shell';

/**
 * 预览页页脚：把公司名当作版面元素放大，其余信息压成细线分隔的栏目。
 * 语言入口直接指向预览页自身，方便在同一版面下横向比较三种语言。
 */
export function PreviewFooter({
  locale,
  name,
  tagline,
  logo,
  nav,
  channels,
  homeLanguages = false,
  labels,
}: {
  locale: Locale;
  name: string;
  tagline: string;
  logo: ReactNode;
  nav: NavView[];
  channels: PreviewChannel[];
  /** 正式站语言入口指向各语言首页；设计预览保留 /design-preview 后缀。 */
  homeLanguages?: boolean;
  labels: {
    company: string;
    contact: string;
    language: string;
    copyright: string;
  };
}) {
  const year = new Date().getFullYear();

  return (
    <footer className="relative bg-navy-950 pt-20 text-navy-200 lg:pt-24">
      <PreviewContainer className="pb-32 lg:pb-28">
        {/* 公司名作为版面主角 */}
        <div className="flex items-center gap-4">
          {logo}
          <h2 className="pv-display text-[clamp(1.6rem,4.4vw,3.6rem)] text-ivory-50">{name}</h2>
        </div>
        {tagline ? (
          <p className="mt-5 max-w-xl text-[0.9rem] leading-relaxed text-navy-300">{tagline}</p>
        ) : null}

        <div className="mt-16 grid grid-cols-12 gap-x-6 gap-y-10 border-t border-[var(--pv-rule-dark)] pt-10">
          <div className="col-span-6 lg:col-span-3">
            <h3 className="pv-mono text-[0.58rem] text-navy-400">{labels.company}</h3>
            <ul className="mt-5 space-y-2.5">
              {nav.map((item) =>
                !item.external && item.href.startsWith('/') ? (
                  <li key={`${item.href}-${item.label}`}>
                    <Link
                      href={item.href}
                      className="text-[0.85rem] text-navy-200 transition-colors hover:text-ivory-50"
                    >
                      {item.label}
                    </Link>
                  </li>
                ) : (
                  <li key={`${item.href}-${item.label}`}>
                    <a
                      href={item.href}
                      {...(item.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                      className="text-[0.85rem] text-navy-200 transition-colors hover:text-ivory-50"
                    >
                      {item.label}
                    </a>
                  </li>
                ),
              )}
            </ul>
          </div>

          <div className="col-span-12 lg:col-span-5">
            <h3 className="pv-mono text-[0.58rem] text-navy-400">{labels.contact}</h3>
            <ul className="mt-5 space-y-2.5">
              {channels.map((channel) => (
                <li key={channel.key}>
                  <ChannelLink
                    channel={channel}
                    className="flex items-baseline gap-3 text-[0.85rem] text-navy-200 transition-colors hover:text-ivory-50"
                  >
                    <span className="pv-mono min-w-[4.5rem] shrink-0 text-[0.55rem] text-navy-400">
                      {channel.label}
                    </span>
                    <span>{channel.value}</span>
                  </ChannelLink>
                </li>
              ))}
            </ul>
          </div>

          <div className="col-span-6 lg:col-span-2 lg:col-start-11">
            <h3 className="pv-mono text-[0.58rem] text-navy-400">{labels.language}</h3>
            <ul className="mt-5 space-y-2.5">
              {locales.map((item) => (
                <li key={item}>
                  <Link
                    href={homeLanguages ? `/${item}` : `/${item}/design-preview`}
                    lang={item}
                    aria-current={item === locale ? 'true' : undefined}
                    className={
                      item === locale
                        ? 'text-[0.85rem] text-copper-300'
                        : 'text-[0.85rem] text-navy-200 transition-colors hover:text-ivory-50'
                    }
                  >
                    {localeNames[item]}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-14 flex flex-col gap-3 border-t border-[var(--pv-rule-dark)] pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[0.78rem] text-navy-300">
            © {year} {name} · {labels.copyright}
          </p>
        </div>
      </PreviewContainer>
    </footer>
  );
}
