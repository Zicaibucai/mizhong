import { getDictionary, type Locale } from '@/lib/i18n';
import type { BlockView } from '@/lib/content';
import { MEDIA_SLOTS } from '@/lib/media';
import { withLocale } from '@/lib/href';
import { Container } from '@/components/ui/container';
import { Button } from '@/components/ui/button';
import { Eyebrow } from '@/components/ui/eyebrow';
import { Media } from '@/components/ui/media';

export function splitTitle(title: string): { line1: string; line2: string | null } {
  const index = title.indexOf('\n');
  if (index === -1) return { line1: title, line2: null };
  return { line1: title.slice(0, index), line2: title.slice(index + 1) };
}

export function Hero({ locale, block }: { locale: Locale; block: BlockView }) {
  const t = getDictionary(locale);
  const { line1, line2 } = splitTitle(block.title);

  return (
    <section className="texture-weave-dark relative overflow-hidden bg-navy-950 text-ivory-50">
      <Container className="grid gap-12 py-16 sm:py-20 lg:grid-cols-2 lg:items-center lg:gap-16 lg:py-28">
        <div>
          <Eyebrow className="text-copper-300">{t.hero.eyebrow}</Eyebrow>
          <h1 className="mt-5 text-4xl font-semibold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
            {line1}
            {line2 ? (
              <>
                <br />
                <span className="text-copper-300">{line2}</span>
              </>
            ) : null}
          </h1>
          {block.subtitle ? (
            <p className="mt-6 max-w-xl text-base leading-relaxed text-navy-100 sm:text-lg">
              {block.subtitle}
            </p>
          ) : null}
          <div className="mt-9 flex flex-wrap gap-4">
            {/* 按钮地址来自后台，可能是 `/products` 这类无语言前缀的写法 */}
            <Button href={withLocale(locale, block.ctaHref || '#products')} variant="accent" size="lg">
              {block.ctaLabel || t.hero.ctaPrimary}
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
