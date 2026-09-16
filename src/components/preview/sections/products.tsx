import { type Locale } from '@/lib/i18n';
import type { ProductCardView } from '@/lib/catalog';
import type { PreviewCopy } from '@/lib/preview/content';
import { ArrowRightIcon } from '@/components/ui/icons';
import { cn } from '@/lib/cn';
import { cssVars, ordinal } from '@/lib/preview/util';
import type { WeaveVariant } from '../textile-artwork';
import { PreviewMedia } from '../preview-media';
import { SectionHead, PreviewContainer } from '../shell';

/**
 * 产品区：优先展示后台已发布的真实商品。
 *
 * 两种数据形态共用同一套版式与同一条渲染路径：
 *   - 有已发布商品：真实主图 + 名称 + 分类 + 简短描述，整块可点击进入详情；
 *   - 没有已发布商品：退回产品分类概览（生成式织纹图形），**不伪装成具体商品**，
 *     并在导语里明确说明当前展示的是分类而不是商品。
 *
 * 版面：桌面为错落的编辑式栅格（每一格栏宽、比例、垂直偏移都不同）；
 * 手机为紧凑的双列拼贴，避免六张接近全屏的大卡片。所有图注默认可见，
 * hover 只做放大与箭头位移的增强，不承载任何信息。
 */

type Tone = 'navy' | 'ink' | 'ivory' | 'sand';

interface TileSpec {
  /** 桌面栏位（手机固定两列） */
  span: string;
  /** 图形比例：手机 / 桌面 */
  aspect: string;
  /** 桌面垂直错落 */
  offset: string;
  tone: Tone;
  variant: WeaveVariant;
}

const LAYOUT: readonly TileSpec[] = [
  { span: 'lg:col-span-5', aspect: 'aspect-[4/5] lg:aspect-[16/11]', offset: '', tone: 'navy', variant: 'warp' },
  {
    span: 'lg:col-span-4 lg:col-start-7',
    aspect: 'aspect-[3/4] lg:aspect-[4/3]',
    offset: 'lg:mt-10',
    tone: 'sand',
    variant: 'plain',
  },
  {
    span: 'lg:col-span-3 lg:col-start-11',
    aspect: 'aspect-square',
    offset: 'lg:mt-20',
    tone: 'ink',
    variant: 'teeth',
  },
  { span: 'lg:col-span-3', aspect: 'aspect-[3/4] lg:aspect-[4/3]', offset: '', tone: 'ivory', variant: 'chevron' },
  {
    span: 'lg:col-span-5 lg:col-start-5',
    aspect: 'aspect-[4/5] lg:aspect-[16/11]',
    offset: 'lg:mt-8',
    tone: 'ink',
    variant: 'twill',
  },
  {
    span: 'lg:col-span-4 lg:col-start-10',
    aspect: 'aspect-[3/4] lg:aspect-[4/3]',
    offset: 'lg:mt-16',
    tone: 'sand',
    variant: 'fold',
  },
];

/** 深色织纹上使用浅色标注，浅色织纹上使用深色标注 */
const isDarkTone = (tone: Tone) => tone === 'navy' || tone === 'ink';

/**
 * 不足六项时的匀齐栏位。
 * 六项用 LAYOUT 的错落排布；其余数量改成等分栏宽，避免出现半空的编辑式凹槽。
 */
const EVEN_SPANS: Record<number, string[]> = {
  1: ['lg:col-span-6'],
  2: ['lg:col-span-6', 'lg:col-span-6'],
  3: ['lg:col-span-4', 'lg:col-span-4', 'lg:col-span-4'],
  4: ['lg:col-span-6', 'lg:col-span-6', 'lg:col-span-6', 'lg:col-span-6'],
  5: ['lg:col-span-6', 'lg:col-span-6', 'lg:col-span-4', 'lg:col-span-4', 'lg:col-span-4'],
};

function specsFor(count: number): readonly TileSpec[] {
  if (count >= 6) return LAYOUT.slice(0, 6);
  const spans = EVEN_SPANS[count] ?? EVEN_SPANS[1];
  return spans.map((span, i) => ({ ...LAYOUT[i % LAYOUT.length], span, offset: '' }));
}

interface Tile {
  key: string;
  href: string;
  /** 分类标签（真实商品才有） */
  label: string | null;
  title: string;
  description: string | null;
  /** 真实主图；分类概览时为 null，回退生成式织纹 */
  cover: { url: string; alt: string } | null;
}

export function PreviewProducts({
  locale,
  index,
  eyebrow,
  title,
  subtitle,
  catalogueHref,
  products,
  categories,
  copy,
  artworkLabel,
}: {
  locale: Locale;
  index: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  /** 完整产品目录地址（已带语言前缀） */
  catalogueHref: string;
  products: ProductCardView[];
  categories: ReadonlyArray<{ name: string; desc: string }>;
  copy: PreviewCopy;
  artworkLabel: string;
}) {
  const published = products.length > 0;

  const tiles: Tile[] = published
    ? products.map((product) => ({
        key: product.id,
        href: `/${locale}/products/${encodeURIComponent(product.slug)}`,
        label: product.categoryName,
        title: product.name,
        description: product.shortDescription,
        cover: product.coverThumbnailUrl || product.coverUrl
          ? {
              url: (product.coverThumbnailUrl || product.coverUrl) as string,
              alt: product.coverAlt?.trim() || product.name,
            }
          : null,
      }))
    : categories.map((category) => ({
        key: category.name,
        href: catalogueHref,
        label: null,
        title: category.name,
        description: category.desc,
        cover: null,
      }));

  const specs = specsFor(tiles.length);

  return (
    <section id="products" className="pv-section relative bg-ivory-50">
      <PreviewContainer>
        <SectionHead
          index={index}
          eyebrow={eyebrow}
          title={title}
          subtitle={published ? copy.productsFromCatalogue : subtitle || copy.productsNoPublished}
          titleClassName="max-w-4xl"
          meta={
            // 退回分类概览时区块标题本身就是「产品分类」，这里不再重复标注
            published ? (
              <span className="pv-mono text-[0.6rem]">{copy.productsPublishedLabel}</span>
            ) : null
          }
        />

        {/* 织机走线：一条缓慢推移的细线，暗示织物在走动 */}
        <div className="pv-threadline mt-10 h-px w-full" aria-hidden="true" />

        <div className="mt-5 grid grid-cols-12 gap-x-3 gap-y-7 sm:gap-x-6 lg:gap-y-6">
          {tiles.map((tile, i) => {
            const spec = specs[i % specs.length];
            const dark = isDarkTone(spec.tone);

            return (
              <article
                key={tile.key}
                data-reveal="plate"
                style={cssVars({ '--pv-delay': `${(i % 3) * 70}ms` })}
                className={cn('col-span-6', spec.span, spec.offset)}
              >
                <a
                  href={tile.href}
                  className="group block focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-copper-500"
                >
                  <div className={cn('pv-tile relative w-full', spec.aspect)} data-tone={dark ? 'dark' : 'light'}>
                    <PreviewMedia
                      locale={locale}
                      uid={`product-${i}`}
                      asset={tile.cover}
                      variant={spec.variant}
                      tone={spec.tone}
                      alt={artworkLabel}
                    />

                    <span className="pv-index pv-num pv-mono text-[0.6rem]" aria-hidden="true">
                      {ordinal(i)}
                    </span>
                  </div>

                  {/* 图注：分类 + 名称 + 简短描述，全部默认可见 */}
                  <div className="pv-tile-cap mt-3">
                    <div className="flex items-baseline justify-between gap-3">
                      <h3 className="line-clamp-2 text-[0.82rem] font-medium leading-snug tracking-[-0.01em] text-navy-950 transition-colors group-hover:text-copper-700 sm:text-[0.9rem]">
                        {tile.title}
                      </h3>
                      <ArrowRightIcon
                        className="pv-arrow hidden h-4 w-4 shrink-0 text-copper-700 lg:block"
                        aria-hidden="true"
                      />
                    </div>

                    {tile.label ? (
                      <p className="pv-mono mt-1.5 text-[0.55rem] text-copper-700">{tile.label}</p>
                    ) : null}

                    {tile.description ? (
                      <p className="mt-1.5 line-clamp-2 text-[0.72rem] leading-relaxed text-muted sm:text-[0.8rem]">
                        {tile.description}
                      </p>
                    ) : null}
                  </div>
                </a>
              </article>
            );
          })}
        </div>

        <div
          data-reveal
          className="mt-12 flex flex-wrap items-center gap-x-8 gap-y-4 border-t border-[var(--pv-rule)] pt-6"
        >
          <a href={catalogueHref} className="pv-btn pv-btn-ink">
            <span>{copy.browseProducts}</span>
            <ArrowRightIcon className="pv-arrow h-4 w-4" />
          </a>
        </div>
      </PreviewContainer>
    </section>
  );
}
