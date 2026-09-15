import { getDictionary, type Locale } from '@/lib/i18n';
import { MEDIA_SLOTS } from '@/lib/media';
import { Container } from '@/components/ui/container';
import { Button } from '@/components/ui/button';
import { Eyebrow } from '@/components/ui/eyebrow';
import { Media } from '@/components/ui/media';

export function Hero({ locale }: { locale: Locale }) {
  const t = getDictionary(locale);

  return (
    <section className="texture-weave-dark relative overflow-hidden bg-navy-950 text-ivory-50">
      <Container className="grid gap-12 py-16 sm:py-20 lg:grid-cols-2 lg:items-center lg:gap-16 lg:py-28">
        <div>
          <Eyebrow className="text-copper-300">{t.hero.eyebrow}</Eyebrow>
          <h1 className="mt-5 text-4xl font-semibold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
            {t.hero.titleLine1}
            <br />
            <span className="text-copper-300">{t.hero.titleLine2}</span>
          </h1>
          <p className="mt-6 max-w-xl text-base leading-relaxed text-navy-100 sm:text-lg">
            {t.hero.subtitle}
          </p>
          <div className="mt-9 flex flex-wrap gap-4">
            <Button href="#products" variant="accent" size="lg">
              {t.hero.ctaPrimary}
            </Button>
            <Button href="#inquiry" variant="outlineLight" size="lg">
              {t.hero.ctaSecondary}
            </Button>
          </div>
        </div>

        <div className="lg:pl-4">
          <Media
            slot={MEDIA_SLOTS.heroImage}
            locale={locale}
            label={t.hero.mediaLabel}
            className="aspect-[4/3] w-full"
            priority
          />
        </div>
      </Container>
    </section>
  );
}
