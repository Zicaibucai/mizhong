import { type Locale } from '@/lib/i18n';
import { MEDIA_SLOTS, PRODUCT_MEDIA_SLOTS } from '@/lib/media';
import { ArrowRightIcon } from '@/components/ui/icons';
import { cn } from '@/lib/cn';
import { cssVars, ordinal } from '@/lib/preview/util';
import { PreviewMedia } from '../preview-media';
import { SectionHead, PreviewContainer } from '../shell';

/**
 * 产品分类：六个分类采用节奏变化的编辑式排布。
 *
 * 刻意不做六张等大卡片 —— 每项占据不同的栏宽、比例与垂直偏移，
 * 让视线沿「大字 → 材料 → 序号」的路径移动，接近材料品牌的样册版式。
 *
 * 媒体位仍然绑定 PRODUCT_MEDIA_SLOTS，后台接入素材后自动替换织纹图形。
 */
interface LayoutSpec {
  /** 桌面端栏位 */
  span: string;
  /** 图形比例 */
  aspect: string;
  /** 垂直错落 */
  offset: string;
  /** 织纹色调（深/浅交替，形成明暗节奏） */
  tone: 'navy' | 'ink' | 'ivory' | 'sand';
}

const LAYOUT: readonly LayoutSpec[] = [
  { span: 'lg:col-span-6', aspect: 'aspect-[4/5]', offset: '', tone: 'navy' },
  { span: 'lg:col-span-4 lg:col-start-9', aspect: 'aspect-[3/4]', offset: 'lg:mt-28', tone: 'sand' },
  { span: 'lg:col-span-4', aspect: 'aspect-square', offset: '', tone: 'ink' },
  { span: 'lg:col-span-7 lg:col-start-6', aspect: 'aspect-[16/11]', offset: 'lg:mt-32', tone: 'ivory' },
  { span: 'lg:col-span-5', aspect: 'aspect-[4/5]', offset: '', tone: 'ink' },
  { span: 'lg:col-span-6 lg:col-start-7', aspect: 'aspect-[3/2]', offset: 'lg:mt-24', tone: 'sand' },
];

/** 深色织纹上使用浅色标注，浅色织纹上使用深色标注 */
const isDarkTone = (tone: LayoutSpec['tone']) => tone === 'navy' || tone === 'ink';

export function PreviewMaterials({
  locale,
  index,
  eyebrow,
  title,
  subtitle,
  ctaLabel,
  ctaHref,
  categories,
  artworkLabel,
}: {
  locale: Locale;
  index: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  ctaLabel: string;
  ctaHref: string;
  categories: ReadonlyArray<{ name: string; desc: string }>;
  artworkLabel: string;
}) {
  return (
    <section id="products" className="relative bg-ivory-50 py-24 lg:py-32">
      <PreviewContainer>
        <SectionHead
          index={index}
          eyebrow={eyebrow}
          title={title}
          subtitle={subtitle}
          titleClassName="max-w-4xl"
        />

        {/* 织机走线：一条缓慢推移的细线，暗示织物在走动 */}
        <div className="pv-threadline mt-14 h-px w-full" aria-hidden="true" />

        <div className="mt-6 grid grid-cols-12 gap-x-6 gap-y-16 lg:gap-y-10">
          {categories.map((category, i) => {
            const spec = LAYOUT[i % LAYOUT.length];
            const slot = PRODUCT_MEDIA_SLOTS[i] ?? MEDIA_SLOTS.heroImage;
            const dark = isDarkTone(spec.tone);

            return (
              <article
                key={category.name}
                data-reveal="plate"
                style={cssVars({ '--pv-delay': `${(i % 2) * 90}ms` })}
                className={cn('col-span-12', spec.span, spec.offset)}
              >
                <a
                  href={ctaHref || '#inquiry'}
                  className="group block focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-copper-500"
                >
                  <div className={cn('pv-plate relative w-full', spec.aspect)}>
                    <PreviewMedia
                      slot={slot}
                      locale={locale}
                      uid={`material-${i}`}
                      tone={spec.tone}
                      alt={artworkLabel}
                    />

                    {/* 编号：压在织纹左上角 */}
                    <span
                      className={cn(
                        'pv-index pv-num pv-mono absolute left-5 top-5 text-[0.6rem]',
                        dark ? 'text-ivory-50' : 'text-navy-900',
                      )}
                      aria-hidden="true"
                    >
                      {ordinal(i)}
                    </span>

                    {/* 遮罩：hover 时自下而上推入分类说明 */}
                    <div className="pv-plate-mask absolute inset-0 hidden items-end p-6 lg:flex">
                      <div className="flex w-full items-end justify-between gap-6">
                        <p className="max-w-md text-[0.85rem] leading-relaxed text-ivory-50/90">
                          {category.desc}
                        </p>
                        <ArrowRightIcon className="pv-arrow h-5 w-5 shrink-0 text-copper-300" />
                      </div>
                    </div>
                  </div>

                  {/* 图注：序号 + 名称，细线分隔 */}
                  <div className="mt-5 flex items-baseline justify-between gap-6 border-t border-[var(--pv-rule)] pt-4">
                    <h3 className="text-[1rem] font-medium tracking-[-0.01em] text-navy-950 transition-colors group-hover:text-copper-700">
                      {category.name}
                    </h3>
                    <span className="pv-num pv-mono text-[0.6rem] text-muted" aria-hidden="true">
                      {ordinal(i)} / {ordinal(categories.length - 1)}
                    </span>
                  </div>

                  {/* 触屏与窄屏没有 hover：说明文字放在图注下方，避免内容丢失 */}
                  <p className="mt-2 text-[0.82rem] leading-relaxed text-muted lg:hidden">
                    {category.desc}
                  </p>
                </a>
              </article>
            );
          })}
        </div>

        {ctaLabel ? (
          <div
            data-reveal
            className="mt-20 flex justify-start border-t border-[var(--pv-rule)] pt-8"
          >
            <a href={ctaHref || '#inquiry'} className="pv-linkline text-[0.9rem] text-navy-900">
              <span>{ctaLabel}</span>
              <ArrowRightIcon className="pv-arrow h-4 w-4" />
            </a>
          </div>
        ) : null}
      </PreviewContainer>
    </section>
  );
}
