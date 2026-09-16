import Link from 'next/link';
import type { Locale } from '@/lib/i18n';
import type { ProductCardView } from '@/lib/catalog';
import { getCatalogDict } from '@/lib/i18n/catalog';
import { cn } from '@/lib/cn';
import { MediaPlaceholder } from '@/components/ui/media-placeholder';
import { ArrowRightIcon } from '@/components/ui/icons';
import { catalogPath, productPath, withQuery } from './urls';

/**
 * 产品卡片。
 *
 * 卡片主体用「拉伸链接」覆盖，因此整张卡片可点击、键盘只产生一个产品级 Tab 停靠点；
 * 分类标签位于覆盖层之上（z-10），仍可单独点击进入该分类的目录页。
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
  const cover = product.coverThumbnailUrl ?? product.coverUrl;
  const alt = product.coverAlt?.trim() || product.name;
  const categoryHref = product.categorySlug
    ? withQuery(catalogPath(locale), { category: product.categorySlug })
    : null;

  return (
    <article className={cn('group relative flex h-full flex-col', className)}>
      <div className="overflow-hidden rounded-xl">
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element -- 素材来自 OSS 动态域名，接入 next/image remotePatterns 后统一替换
          <img
            src={cover}
            alt={alt}
            loading="lazy"
            className="aspect-[4/3] w-full rounded-xl border border-navy-200/80 object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <MediaPlaceholder slot="product.cover" label={product.name} className="aspect-[4/3]" />
        )}
      </div>

      <div className="mt-4 flex flex-1 flex-col">
        {product.categoryName ? (
          categoryHref ? (
            <Link
              href={categoryHref}
              className="relative z-10 inline-flex w-fit items-center rounded-full bg-copper-50 px-3 py-1 text-xs font-medium text-copper-700 transition-colors hover:bg-copper-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-copper-500"
            >
              {product.categoryName}
            </Link>
          ) : (
            <span className="inline-flex w-fit items-center rounded-full bg-copper-50 px-3 py-1 text-xs font-medium text-copper-700">
              {product.categoryName}
            </span>
          )
        ) : null}

        <h3 className="mt-3 text-base font-semibold leading-snug text-navy-900">
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

        <span className="mt-auto inline-flex items-center gap-1.5 pt-5 text-sm font-medium text-copper-700">
          {dict.list.viewDetails}
          <ArrowRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </span>
      </div>
    </article>
  );
}
