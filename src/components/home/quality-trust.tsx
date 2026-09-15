import { getDictionary, type Locale } from '@/lib/i18n';
import { MEDIA_SLOTS } from '@/lib/media';
import { Container } from '@/components/ui/container';
import { SectionHeading } from '@/components/ui/section-heading';
import { Media } from '@/components/ui/media';

const CERTIFICATE_SLOTS = [
  MEDIA_SLOTS.certificate1,
  MEDIA_SLOTS.certificate2,
  MEDIA_SLOTS.certificate3,
];

export function QualityTrust({ locale }: { locale: Locale }) {
  const t = getDictionary(locale);

  return (
    <section
      id="quality"
      className="texture-weave-dark scroll-mt-20 bg-navy-950 py-20 text-ivory-50 lg:py-28"
    >
      <Container>
        <SectionHeading
          tone="dark"
          eyebrow={t.quality.eyebrow}
          title={t.quality.title}
          description={t.quality.subtitle}
        />

        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {t.quality.principles.map((p, i) => (
            <article key={p.title} className="rounded-xl border border-navy-800 bg-navy-900/60 p-7">
              <span className="font-mono text-sm text-copper-300">{String(i + 1).padStart(2, '0')}</span>
              <h3 className="mt-5 text-lg font-semibold text-ivory-50">{p.title}</h3>
              <p className="mt-2.5 text-sm leading-relaxed text-navy-200">{p.desc}</p>
            </article>
          ))}
        </div>

        <div className="mt-20">
          <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
            <h3 className="text-xl font-semibold text-ivory-50">{t.quality.certificatesTitle}</h3>
            <p className="text-sm text-navy-300">{t.quality.certificatesNote}</p>
          </div>
          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
            {CERTIFICATE_SLOTS.map((slot) => (
              <Media
                key={slot}
                slot={slot}
                locale={locale}
                label={t.quality.certificatesPlaceholder}
                className="aspect-[3/2] w-full"
              />
            ))}
          </div>
        </div>
      </Container>
    </section>
  );
}
