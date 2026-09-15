import Link from 'next/link';
import { getDictionary, type Locale } from '@/lib/i18n';
import { companyName } from '@/lib/site-config';
import { Container } from '@/components/ui/container';
import { Button } from '@/components/ui/button';
import { BrandLogo } from './brand-logo';
import { LanguageSwitcher } from './language-switcher';
import { MobileMenu } from './mobile-menu';

export function SiteHeader({ locale }: { locale: Locale }) {
  const t = getDictionary(locale);
  const name = companyName(locale);

  const navItems = [
    { label: t.nav.products, href: '#products' },
    { label: t.nav.manufacturing, href: '#manufacturing' },
    { label: t.nav.quality, href: '#quality' },
    { label: t.nav.contact, href: '#inquiry' },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-navy-100 bg-ivory-50/90 backdrop-blur">
      <Container className="flex h-16 items-center justify-between gap-3">
        <Link href={`/${locale}`} className="flex min-w-0 items-center gap-2.5" aria-label={name}>
          <BrandLogo locale={locale} className="h-8 w-auto shrink-0" />
          <span className="truncate text-sm font-semibold tracking-tight text-navy-900 sm:text-[15px]">
            {name}
          </span>
        </Link>

        <nav aria-label={t.nav.primary} className="hidden items-center gap-8 lg:flex">
          {navItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="text-sm font-medium text-navy-700 transition-colors hover:text-navy-900"
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-1.5">
          <LanguageSwitcher current={locale} label={t.lang.label} />
          <Button href="#inquiry" variant="primary" size="md" className="hidden lg:inline-flex">
            {t.nav.cta}
          </Button>
          <MobileMenu
            navItems={navItems}
            ctaLabel={t.nav.cta}
            ctaHref="#inquiry"
            menuLabel={t.nav.menu}
            closeLabel={t.nav.close}
            navLabel={t.nav.mobile}
          />
        </div>
      </Container>
    </header>
  );
}
