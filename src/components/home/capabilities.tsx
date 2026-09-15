import { getDictionary, type Locale } from '@/lib/i18n';
import type { BlockView } from '@/lib/content';
import { Container } from '@/components/ui/container';
import { SectionHeading } from '@/components/ui/section-heading';

export function Capabilities({ locale, block }: { locale: Locale; block: BlockView }) {
  const t = getDictionary(locale);

  return (
    <section className="py-20 lg:py-28">
      <Container>
        <SectionHeading
          eyebrow={t.capabilities.eyebrow}
          title={block.title}
          description={block.subtitle}
          body={block.body}
        />
        <div className="mt-14 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
          {t.capabilities.items.map((item, i) => (
            <article key={item.title} className="border-t border-navy-200 pt-6">
              <span className="font-mono text-sm font-medium text-copper-700">
                {String(i + 1).padStart(2, '0')}
              </span>
              <h3 className="mt-4 text-lg font-semibold text-navy-900">{item.title}</h3>
              <p className="mt-2.5 text-sm leading-relaxed text-muted">{item.desc}</p>
            </article>
          ))}
        </div>
      </Container>
    </section>
  );
}
