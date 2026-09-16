import { Container } from '@/components/ui/container';

/**
 * 目录 / 搜索页面顶部的标题区（沿用首页 hero 的深色织纹语言）。
 * 只渲染标题与副标题，正文内容一律来自 src/lib/i18n/catalog.ts。
 */
export function CatalogPageHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <section className="texture-weave-dark border-b border-navy-800 bg-navy-950 text-ivory-50">
      <Container className="py-12 sm:py-14">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
        {subtitle ? (
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-navy-100">{subtitle}</p>
        ) : null}
      </Container>
    </section>
  );
}
