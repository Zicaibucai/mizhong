import { getDictionary, type Locale } from '@/lib/i18n';
import { company, contactAddress } from '@/lib/site-config';
import { Container } from '@/components/ui/container';
import { Button } from '@/components/ui/button';
import { Eyebrow } from '@/components/ui/eyebrow';
import { PhoneIcon, PinIcon } from '@/components/ui/icons';

export function InquiryCta({ locale }: { locale: Locale }) {
  const t = getDictionary(locale);

  return (
    <section id="inquiry" className="scroll-mt-20 py-20 lg:py-28">
      <Container>
        <div className="texture-weave-dark relative overflow-hidden rounded-2xl bg-navy-900 px-6 py-14 text-ivory-50 sm:px-14">
          <div className="mx-auto max-w-2xl text-center">
            <Eyebrow className="text-copper-300">{t.inquiry.eyebrow}</Eyebrow>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
              {t.inquiry.title}
            </h2>
            <p className="mt-4 text-base leading-relaxed text-navy-100">{t.inquiry.subtitle}</p>
            <div className="mt-9 flex justify-center">
              <Button href={`mailto:${company.contact.email}`} variant="accent" size="lg">
                {t.inquiry.cta}
              </Button>
            </div>
            <p className="mt-5 text-sm text-navy-300">{t.inquiry.note}</p>
          </div>

          <dl className="mx-auto mt-12 grid max-w-3xl gap-6 sm:grid-cols-3">
            <div className="flex flex-col items-center gap-2 text-center">
              <dt className="text-xs uppercase tracking-wider text-navy-300">{t.inquiry.emailLabel}</dt>
              <dd>
                <a
                  href={`mailto:${company.contact.email}`}
                  className="text-sm text-ivory-50 transition-colors hover:text-copper-300"
                >
                  {company.contact.email}
                </a>
              </dd>
            </div>
            <div className="flex flex-col items-center gap-2 text-center">
              <dt className="text-xs uppercase tracking-wider text-navy-300">{t.inquiry.phoneLabel}</dt>
              <dd>
                <a
                  href={`tel:${company.contact.phone.replace(/\s/g, '')}`}
                  className="flex items-center gap-2 text-sm text-ivory-50 transition-colors hover:text-copper-300"
                >
                  <PhoneIcon className="h-4 w-4 text-copper-400" />
                  {company.contact.phone}
                </a>
              </dd>
            </div>
            <div className="flex flex-col items-center gap-2 text-center">
              <dt className="text-xs uppercase tracking-wider text-navy-300">{t.inquiry.addressLabel}</dt>
              <dd className="flex items-center gap-2 text-sm text-ivory-50">
                <PinIcon className="h-4 w-4 text-copper-400" />
                {contactAddress(locale)}
              </dd>
            </div>
          </dl>
        </div>
      </Container>
    </section>
  );
}
