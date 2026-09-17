import { PreviewContainer } from '@/components/preview/shell';

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
    <section className="v2-page-hero texture-weave-dark border-b border-navy-800 bg-navy-950 text-ivory-50">
      <PreviewContainer className="relative z-10">
        <div className="grid grid-cols-12 gap-x-6 gap-y-8">
          <div className="col-span-12 lg:col-span-8">
            <p className="pv-mono text-[0.6rem] text-copper-300">INDEX / PRODUCTS</p>
            <h1 className="pv-display mt-5 text-[clamp(2.8rem,6.5vw,6.5rem)]">{title}</h1>
          </div>
          {subtitle ? (
            <p className="col-span-12 max-w-xl self-end text-[0.95rem] leading-relaxed text-navy-200 lg:col-span-4">
              {subtitle}
            </p>
          ) : null}
        </div>
      </PreviewContainer>
    </section>
  );
}
