import { getDictionary, type Locale } from '@/lib/i18n';
import { MEDIA_SLOTS, PRODUCT_MEDIA_SLOTS } from '@/lib/media';
import { Container } from '@/components/ui/container';
import { SectionHeading } from '@/components/ui/section-heading';
import { Button } from '@/components/ui/button';
import { Media } from '@/components/ui/media';

export function ProductsPreview({ locale }: { locale: Locale }) {
  const t = getDictionary(locale);

  return (
    <section id="products" className="scroll-mt-20 bg-white py-20 lg:py-28">
      <Container>
        <SectionHeading
          eyebrow={t.products.eyebrow}
          title={t.products.title}
          description={t.products.subtitle}
        />
        <div className="mt-14 grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          {t.products.categories.map((cat, i) => (
            <a key={cat.name} href="#inquiry" className="group block">
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
        <div className="mt-14 text-center">
          <Button href="#inquiry" variant="outline">
            {t.products.cta}
          </Button>
        </div>
      </Container>
    </section>
  );
}
