'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import type { Locale } from '@/lib/i18n';
import type { NavView } from '@/lib/content';
import { companyShortName } from '@/lib/site-config';
import { ArrowRightIcon } from '@/components/ui/icons';
import { LanguageSwitcher } from '@/components/layout/language-switcher';
import { MobileMenu } from '@/components/layout/mobile-menu';
import { PreviewContainer } from './shell';

export interface HeaderLabels {
  menu: string;
  close: string;
  mobileNav: string;
  primaryNav: string;
  lang: string;
  cta: string;
}

/**
 * 预览页页头：fixed 覆盖在首屏之上。
 *
 * 滚动状态由 ScrollChoreography 写入 `data-scrolled`，样式层负责切换
 * 「透明压深底 → 象牙白实底 + 细线 + 收紧高度」，这里不做任何 React 重渲染。
 *
 * 语言切换与移动端菜单复用正式站组件，保留原有无障碍语义与行为。
 */
export function PreviewHeader({
  locale,
  name,
  logo,
  nav,
  ctaHref,
  homeHref,
  labels,
}: {
  locale: Locale;
  name: string;
  /** 后台配置的品牌 Logo（未上传时为 null），由服务器组件渲染后传入 */
  logo: ReactNode;
  nav: NavView[];
  ctaHref: string;
  /** 正式站传入 /{locale}；设计预览默认回到 /{locale}/design-preview */
  homeHref?: string;
  labels: HeaderLabels;
}) {
  const navItems = nav.map((item) => ({
    label: item.label,
    href: item.href,
    external: item.external,
  }));

  return (
    <header data-pv-header className="pv-header fixed inset-x-0 top-0 z-50">
      <PreviewContainer>
        <div className="pv-header-inner flex items-center justify-between gap-6">
          {/* 品牌：回到预览页自身（当前语言），未上传 Logo 时只显示文字公司名 */}
          <Link
            href={homeHref ?? `/${locale}/design-preview`}
            className="flex min-w-0 items-center gap-3 text-current"
            aria-label={name}
          >
            {logo}
            {/* 窄屏只显示品牌短名：全称在手机上会被截成省略号（英文、阿语尤其明显） */}
            <span className="truncate text-[0.95rem] font-medium tracking-[-0.01em] text-current">
              <span className="hidden sm:inline">{name}</span>
              <span className="sm:hidden">{companyShortName(locale)}</span>
            </span>
          </Link>

          <nav aria-label={labels.primaryNav} className="hidden items-center gap-9 lg:flex">
            {navItems.map((item) =>
              // 站内路径用 next/link（客户端跳转 + 预取），页内锚点保持原生 <a>
              !item.external && item.href.startsWith('/') ? (
                <Link
                  key={`${item.href}-${item.label}`}
                  href={item.href}
                  className="pv-header-link pv-mono text-[0.75rem]"
                >
                  {item.label}
                </Link>
              ) : (
                <a
                  key={`${item.href}-${item.label}`}
                  href={item.href}
                  {...(item.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                  className="pv-header-link pv-mono text-[0.75rem]"
                >
                  {item.label}
                </a>
              ),
            )}
          </nav>

          <div className="flex shrink-0 items-center gap-2">
            {/* 语言切换：复用正式站组件，配色由预览样式在深色页头下覆盖 */}
            <div className="pv-lang hidden sm:block">
              <LanguageSwitcher current={locale} label={labels.lang} />
            </div>

            <a
              href={ctaHref}
              className="pv-header-cta hidden items-center gap-2 text-[0.7rem] lg:inline-flex"
            >
              <span className="pv-mono">{labels.cta}</span>
              <ArrowRightIcon className="pv-arrow h-3.5 w-3.5" />
            </a>

            <div className="pv-mobile">
              <MobileMenu
                navItems={navItems}
                ctaLabel={labels.cta}
                ctaHref={ctaHref}
                menuLabel={labels.menu}
                closeLabel={labels.close}
                navLabel={labels.mobileNav}
                currentLocale={locale}
                languageLabel={labels.lang}
              />
            </div>
          </div>
        </div>
      </PreviewContainer>

      {/* 阅读进度：贯穿页头底边的一根铜色织线 */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px">
        <div className="pv-progress h-full bg-copper-400/70" />
      </div>
    </header>
  );
}
