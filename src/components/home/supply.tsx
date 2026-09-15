import { getDictionary, type Locale } from '@/lib/i18n';
import type { BlockView } from '@/lib/content';
import { MEDIA_SLOTS } from '@/lib/media';
import { Container } from '@/components/ui/container';
import { Eyebrow } from '@/components/ui/eyebrow';
import { CheckIcon } from '@/components/ui/icons';
import { Media } from '@/components/ui/media';

export function Supply({ locale, block }: { locale: Locale; block: BlockView }) {
  const t = getDictionary(locale);

  return (
    <section id="supply" className="scroll-mt-20 py-20 lg:py-28">
      <Container className="grid gap-12 lg:grid-cols-2 lg:items-center lg:gap-16">
        <div className="lg:order-2">
          <Eyebrow>{t.supply.eyebrow}</Eyebrow>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-navy-900 sm:text-4xl">
            {block.title}
          </h2>
          {block.subtitle ? (
            <p className="mt-4 text-base leading-relaxed text-muted">{block.subtitle}</p>
          ) : null}
          {block.body ? (
            <p className="mt-3 text-base leading-relaxed text-muted">{block.body}</p>
          ) : null}
          <ul className="mt-8 space-y-4">
            {t.supply.points.map((point) => (
              <li key={point} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-copper-100 text-copper-700">
                  <CheckIcon className="h-4 w-4" />
                </span>
                <span className="text-navy-800">{point}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="lg:order-1">
          <Media
            slot={MEDIA_SLOTS.supplyImage}
            locale={locale}
            label={t.supply.mediaLabel}
            className="aspect-[4/3] w-full"
          />
        </div>
      </Container>
    </section>
  );
}
