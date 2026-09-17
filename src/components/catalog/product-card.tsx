'use client';

import Link from 'next/link';
import type { Locale } from '@/lib/i18n';
import type { ProductCardView } from '@/lib/catalog';
import { getCatalogDict } from '@/lib/i18n/catalog';
import { formatMoq, formatPrice } from '@/lib/product-format';
import { cn } from '@/lib/cn';
import { MediaPlaceholder } from '@/components/ui/media-placeholder';
import { ArrowRightIcon } from '@/components/ui/icons';
import { ProductCardMedia, useHoverVideo } from './product-card-media';
import { catalogPath, productPath, withQuery } from './urls';

/**
 * 产品卡片。
 *
 * 卡片主体用「拉伸链接」覆盖，因此整张卡片可点击、键盘只产生一个产品级 Tab 停靠点；
 * 分类标签位于覆盖层之上（z-10），仍可单独点击进入该分类的目录页。
 *
 * 关键信息（名称、价格、MOQ、尺寸）全部在 `<video>` 之外的 DOM 里，
 * 因此悬停视频只是视觉增强，不承载任何唯一信息。
 *
 * 这是客户端组件：悬停视频需要把 mouseenter / mouseleave 挂在卡片根元素上
 * （拉伸链接覆盖整张卡片，挂在图片容器上收不到事件，详见 product-card-media.tsx）。
 */
export function ProductCard({
  locale,
  product,
  className,
}: {
  locale: Locale;
  product: ProductCardView;
  className?: string;
}) {
  const dict = getCatalogDict(locale);
  const href = productPath(locale, product.slug);
  const alt = product.coverAlt?.trim() || product.name;
  const categoryHref = product.categorySlug
    ? withQuery(catalogPath(locale), { category: product.categorySlug })
    : null;

  const hover = useHoverVideo(product.hoverVideoUrl);
  const price = formatPrice(product, locale);
  const moq = formatMoq(product.moq, product.moqUnit, locale);
  const size = product.sizeSummary?.trim() || null;
  const negotiable = product.priceMode === 'NEGOTIABLE' || !product.priceMin;

  return (
    <article
      {...hover.handlers}
      className={cn('group relative flex h-full flex-col border-t border-navy-200 pt-3', className)}
    >
      <ProductCardMedia
        coverUrl={product.coverThumbnailUrl ?? product.coverUrl}
        coverAlt={alt}
        hoverVideoPosterUrl={product.hoverVideoPosterUrl}
        hover={hover}
        placeholder={<MediaPlaceholder slot="product.cover" label={product.name} className="aspect-[4/3]" />}
      />

      <div className="mt-4 flex flex-1 flex-col">
        {product.categoryName ? (
          categoryHref ? (
            <Link
              href={categoryHref}
              className="pv-mono relative z-10 inline-flex w-fit text-[0.55rem] text-copper-700 transition-colors hover:text-copper-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-copper-500"
            >
              {product.categoryName}
            </Link>
          ) : (
            <span className="pv-mono inline-flex w-fit text-[0.55rem] text-copper-700">
              {product.categoryName}
            </span>
          )
        ) : null}

        <h3 className="mt-2.5 text-[1.05rem] font-medium leading-snug tracking-[-0.015em] text-navy-950">
          <Link
            href={href}
            className="transition-colors after:absolute after:inset-0 after:content-[''] group-hover:text-copper-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-copper-500"
          >
            {product.name}
          </Link>
        </h3>

        {product.shortDescription ? (
          <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-muted">
            {product.shortDescription}
          </p>
        ) : null}

        <p
          className={cn(
            'mt-3 text-[0.9rem] font-medium tracking-tight',
            negotiable ? 'text-navy-600' : 'text-copper-800',
          )}
        >
          {price}
        </p>

        {moq || size ? (
          <dl className="mt-2.5 space-y-1 text-xs leading-relaxed text-navy-600">
            {moq ? (
              <div className="flex gap-1.5">
                <dt className="shrink-0 text-navy-400">{dict.detail.moqLabel}</dt>
                <dd className="min-w-0">{moq}</dd>
              </div>
            ) : null}
            {size ? (
              <div className="flex gap-1.5">
                <dt className="shrink-0 text-navy-400">{dict.list.sizeLabel}</dt>
                <dd className="min-w-0 line-clamp-2">{size}</dd>
              </div>
            ) : null}
          </dl>
        ) : null}

        <div className="mt-auto flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-navy-100 pt-4 text-sm font-medium">
          <span className="inline-flex items-center gap-1.5 text-copper-700">
            {dict.list.viewDetails}
            <ArrowRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </span>
          <Link
            href={`${href}#inquiry`}
            className="relative z-10 text-navy-700 underline-offset-4 transition-colors hover:text-copper-700 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-copper-500"
          >
            {dict.list.inquiryShort}
          </Link>
        </div>
      </div>
    </article>
  );
}
