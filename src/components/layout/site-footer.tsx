import { getDictionary, type Locale } from '@/lib/i18n';
import type { CompanyView, ContactView, NavView } from '@/lib/content';
import { Container } from '@/components/ui/container';
import { MailIcon, PhoneIcon, PinIcon } from '@/components/ui/icons';
import { BrandLogo } from './brand-logo';

const CONTACT_ICON = {
  EMAIL: MailIcon,
  WHATSAPP: PhoneIcon,
  PHONE: PhoneIcon,
  WECHAT: PhoneIcon,
  ADDRESS: PinIcon,
} as const;

export function SiteFooter({
  locale,
  company,
  contacts,
  nav,
}: {
  locale: Locale;
  company: CompanyView;
  contacts: ContactView[];
  nav: NavView[];
}) {
  const t = getDictionary(locale);
  const year = new Date().getFullYear();

  return (
    <footer className="bg-navy-950 text-navy-100">
      {/* 底部留白：为移动端联系栏与桌面端悬浮入口留出空间，避免遮挡页脚内容 */}
      <Container className="pt-16 pb-28 lg:pb-24">
        <div className="grid gap-12 lg:grid-cols-[1.6fr_1fr_1.3fr]">
          <div>
            <div className="flex items-center gap-2.5">
              <BrandLogo locale={locale} className="h-8 w-auto" />
              <span className="text-[15px] font-semibold tracking-tight text-ivory-50">
                {company.name}
              </span>
            </div>
            {company.tagline ? (
              <p className="mt-5 max-w-sm text-sm leading-relaxed text-navy-200">{company.tagline}</p>
            ) : null}
            {company.address ? (
              <p className="mt-4 max-w-sm text-sm leading-relaxed text-navy-300">{company.address}</p>
            ) : null}
            {company.businessHours ? (
              <p className="mt-2 max-w-sm text-sm leading-relaxed text-navy-300">
                {company.businessHours}
              </p>
            ) : null}
          </div>

          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-ivory-50">
              {t.footer.companyTitle}
            </h3>
            <ul className="mt-5 space-y-3 text-sm">
              {nav.map((item) => (
                <li key={`${item.href}-${item.label}`}>
                  <a
                    href={item.href}
                    {...(item.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                    className="text-navy-200 transition-colors hover:text-ivory-50"
                  >
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-ivory-50">
              {t.footer.contactTitle}
            </h3>
            {contacts.length > 0 ? (
              <ul className="mt-5 space-y-3 text-sm text-navy-200">
                {contacts.map((contact) => {
                  const Icon = CONTACT_ICON[contact.type];
                  const content = (
                    <>
                      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-copper-400" />
                      <span>
                        <span className="sr-only">{contact.label}: </span>
                        {contact.value}
                      </span>
                    </>
                  );
                  return (
                    <li key={contact.id}>
                      {contact.href ? (
                        <a
                          href={contact.href}
                          {...(contact.type === 'WHATSAPP'
                            ? { target: '_blank', rel: 'noopener noreferrer' }
                            : {})}
                          className="flex items-start gap-3 transition-colors hover:text-ivory-50"
                        >
                          {content}
                        </a>
                      ) : (
                        <span className="flex items-start gap-3">{content}</span>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="mt-5 text-sm text-navy-300">{t.footer.noContacts}</p>
            )}
          </div>
        </div>

        <div className="mt-14 flex flex-col gap-4 border-t border-navy-800 pt-8 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-navy-300">
            © {year} {company.name} · {t.footer.copyright}
          </p>
        </div>
      </Container>
    </footer>
  );
}
