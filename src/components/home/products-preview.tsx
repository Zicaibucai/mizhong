import { getDictionary, type Locale } from '@/lib/i18n';
import type { BlockView } from '@/lib/content';
import { MEDIA_SLOTS, PRODUCT_MEDIA_SLOTS } from '@/lib/media';
import { Container } from '@/components/ui/container';
import { SectionHeading } from '@/components/ui/section-heading';
import { Button } from '@/components/ui/button';
import { Media } from '@/components/ui/media';

/** 站内路径补上语言前缀（锚点与绝对地址保持原样） */
function withLocale(href: string, locale: Locale): string {
  if (!href.startsWith('/')) return href;
  if (/^\/(zh|en|vi)(\/|$)/.test(href)) return href;
  return `/${locale}${href}`;
}

export function ProductsPreview({ locale, block }: { locale: Locale; block: BlockView }) {
  const t = getDictionary(locale);
  const catalogueHref = `/${locale}/products`;

  return (
    <section id="products" className="scroll-mt-20 bg-white py-20 lg:py-28">
      <Container>
        <SectionHeading
          eyebrow={t.products.eyebrow}
          title={block.title}
          description={block.subtitle}
          body={block.body}
        />
        <div className="mt-14 grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          {t.products.categories.map((cat, i) => (
            <a key={cat.name} href={catalogueHref} className="group block">
              <Media
                slot={PRODUCT_MEDIA_SLOTS[i] ?? MEDIA_SLOTS.heroImage}
                locale={locale}
                className="aspect-[4/3] w-full"
              />
              <h3 className="mt-4 text-base font-semibold text-navy-900 transition-colors group-hover:text-copper-600">
                {cat.name}
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">{cat.desc}</p>
            </a>
          ))}
        </div>
        {block.ctaLabel ? (
          <div className="mt-14 text-center">
            <Button href={withLocale(block.ctaHref || '/products', locale)} variant="outline">
              {block.ctaLabel}
            </Button>
          </div>
        ) : null}
      </Container>
    </section>
  );
}
