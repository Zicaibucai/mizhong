import { getDictionary, type Locale } from '@/lib/i18n';
import { companyName, contactAddress, icpText, company } from '@/lib/site-config';
import { Container } from '@/components/ui/container';
import { MailIcon, PhoneIcon, PinIcon } from '@/components/ui/icons';
import { BrandLogo } from './brand-logo';

interface FooterLink {
  label: string;
  href: string;
}

export function SiteFooter({ locale }: { locale: Locale }) {
  const t = getDictionary(locale);
  const name = companyName(locale);
  const year = new Date().getFullYear();

  const productLinks: FooterLink[] = [
    { label: t.nav.products, href: '#products' },
    { label: t.nav.cta, href: '#inquiry' },
  ];
  const companyLinks: FooterLink[] = [
    { label: t.nav.manufacturing, href: '#manufacturing' },
    { label: t.nav.quality, href: '#quality' },
    { label: t.nav.contact, href: '#inquiry' },
  ];

  return (
    <footer className="bg-navy-950 text-navy-100">
      <Container className="py-16">
        <div className="grid gap-12 lg:grid-cols-[1.6fr_1fr_1fr_1.3fr]">
          <div>
            <div className="flex items-center gap-2.5">
              <BrandLogo locale={locale} className="h-8 w-auto" />
              <span className="text-[15px] font-semibold tracking-tight text-ivory-50">{name}</span>
            </div>
            <p className="mt-5 max-w-sm text-sm leading-relaxed text-navy-200">{t.footer.tagline}</p>
          </div>

          <FooterColumn title={t.footer.productsTitle} links={productLinks} />
          <FooterColumn title={t.footer.companyTitle} links={companyLinks} />

          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-ivory-50">
              {t.footer.contactTitle}
            </h3>
            <ul className="mt-5 space-y-3 text-sm text-navy-200">
              <li>
                <a
                  href={`mailto:${company.contact.email}`}
                  className="flex items-start gap-3 transition-colors hover:text-ivory-50"
                >
                  <MailIcon className="mt-0.5 h-4 w-4 shrink-0 text-copper-400" />
                  {company.contact.email}
                </a>
              </li>
              <li>
                <a
                  href={`tel:${company.contact.phone.replace(/\s/g, '')}`}
                  className="flex items-start gap-3 transition-colors hover:text-ivory-50"
                >
                  <PhoneIcon className="mt-0.5 h-4 w-4 shrink-0 text-copper-400" />
                  {company.contact.phone}
                </a>
              </li>
              <li className="flex items-start gap-3">
                <PinIcon className="mt-0.5 h-4 w-4 shrink-0 text-copper-400" />
                {contactAddress(locale)}
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-14 flex flex-col gap-4 border-t border-navy-800 pt-8 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-navy-300">
            © {year} {companyName(locale)} · {t.footer.copyright}
          </p>
          <p className="text-xs text-navy-400">{icpText(locale)}</p>
        </div>
      </Container>
    </footer>
  );
}

function FooterColumn({ title, links }: { title: string; links: FooterLink[] }) {
  return (
    <div>
      <h3 className="text-sm font-semibold uppercase tracking-wider text-ivory-50">{title}</h3>
      <ul className="mt-5 space-y-3 text-sm">
        {links.map((link) => (
          <li key={link.href}>
            <a href={link.href} className="text-navy-200 transition-colors hover:text-ivory-50">
              {link.label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
