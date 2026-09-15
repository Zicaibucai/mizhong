import { getDictionary, type Locale } from '@/lib/i18n';
import type { BlockView, ContactView } from '@/lib/content';
import { Container } from '@/components/ui/container';
import { Button } from '@/components/ui/button';
import { Eyebrow } from '@/components/ui/eyebrow';
import { MailIcon, PhoneIcon, PinIcon } from '@/components/ui/icons';

const CONTACT_ICON = {
  EMAIL: MailIcon,
  WHATSAPP: PhoneIcon,
  PHONE: PhoneIcon,
  WECHAT: PhoneIcon,
  ADDRESS: PinIcon,
} as const;

export function InquiryCta({
  locale,
  block,
  contacts,
}: {
  locale: Locale;
  block: BlockView;
  contacts: ContactView[];
}) {
  const t = getDictionary(locale);
  const primaryContact = contacts.find((item) => item.href);

  return (
    <section id="inquiry" className="scroll-mt-20 py-20 lg:py-28">
      <Container>
        <div className="texture-weave-dark relative overflow-hidden rounded-2xl bg-navy-900 px-6 py-14 text-ivory-50 sm:px-14">
          <div className="mx-auto max-w-2xl text-center">
            <Eyebrow className="text-copper-300">{t.inquiry.eyebrow}</Eyebrow>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">{block.title}</h2>
            {block.subtitle ? (
              <p className="mt-4 text-base leading-relaxed text-navy-100">{block.subtitle}</p>
            ) : null}
            {block.body ? (
              <p className="mt-3 text-base leading-relaxed text-navy-200">{block.body}</p>
            ) : null}
            <div className="mt-9 flex justify-center">
              {primaryContact?.href ? (
                <Button href={primaryContact.href} variant="accent" size="lg">
                  {block.ctaLabel || t.inquiry.cta}
                </Button>
              ) : (
                <span className="rounded-full border border-ivory-50/30 px-6 py-3 text-sm text-navy-100">
                  {t.footer.noContacts}
                </span>
              )}
            </div>
            {!primaryContact ? (
              <p className="mt-5 text-sm text-navy-300">{t.inquiry.note}</p>
            ) : null}
          </div>

          {contacts.length > 0 ? (
            <dl className="mx-auto mt-12 grid max-w-3xl gap-6 sm:grid-cols-3">
              {contacts.map((contact) => {
                const Icon = CONTACT_ICON[contact.type];
                return (
                  <div key={contact.id} className="flex flex-col items-center gap-2 text-center">
                    <dt className="text-xs uppercase tracking-wider text-navy-300">{contact.label}</dt>
                    <dd className="flex items-center gap-2 text-sm text-ivory-50">
                      <Icon className="h-4 w-4 text-copper-400" />
                      {contact.href ? (
                        <a
                          href={contact.href}
                          {...(contact.type === 'WHATSAPP'
                            ? { target: '_blank', rel: 'noopener noreferrer' }
                            : {})}
                          className="transition-colors hover:text-copper-300"
                        >
                          {contact.value}
                        </a>
                      ) : (
                        <span>{contact.value}</span>
                      )}
                    </dd>
                  </div>
                );
              })}
            </dl>
          ) : null}
        </div>
      </Container>
    </section>
  );
}
