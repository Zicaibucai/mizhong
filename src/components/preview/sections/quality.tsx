import { type Locale } from '@/lib/i18n';
import { MEDIA_SLOTS } from '@/lib/media';
import { cssVars, ordinal } from '@/lib/preview/util';
import { PreviewMedia } from '../preview-media';
import { PreviewContainer, SectionHead } from '../shell';

/**
 * 质量与信任：大幅材料细节 + 技术标注 + 层级排版。
 *
 * 公司尚未确认任何认证资质，因此这里**不渲染任何证书图形或占位框**：
 * 只用后台可编辑的说明文字（certificatesNote）如实陈述现状。
 * 材料细节同样是生成的织纹示意，不是产品照片。
 */
const CALLOUTS: ReadonlyArray<{ left: string; top: string; width: string }> = [
  { left: '8%', top: '20%', width: '5rem' },
  { left: '52%', top: '47%', width: '7rem' },
  { left: '16%', top: '74%', width: '4rem' },
];

export function PreviewQuality({
  locale,
  index,
  eyebrow,
  title,
  subtitle,
  body,
  principles,
  certificatesTitle,
  certificatesNote,
  artworkLabel,
}: {
  locale: Locale;
  index: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  body: string;
  principles: ReadonlyArray<{ title: string; desc: string }>;
  certificatesTitle: string;
  certificatesNote: string;
  artworkLabel: string;
}) {
  return (
    <section id="quality" className="relative bg-ivory-50 py-24 lg:py-32">
      <PreviewContainer>
        <SectionHead
          index={index}
          eyebrow={eyebrow}
          title={title}
          subtitle={subtitle}
          titleClassName="max-w-3xl"
        />

        {body ? (
          <p
            data-reveal
            className="pv-display mt-12 max-w-4xl text-[clamp(1.1rem,2.2vw,1.7rem)] text-navy-900/85"
          >
            {body}
          </p>
        ) : null}

        <div className="mt-16 grid grid-cols-12 gap-x-6 gap-y-14">
          {/* 材料细节：放大的经纬结构 + 编号引线 */}
          <div className="col-span-12 lg:col-span-8" data-reveal="plate">
            <div className="pv-plate relative aspect-[3/2] w-full">
              <PreviewMedia
                slot={MEDIA_SLOTS.qualityImage}
                locale={locale}
                uid="quality-detail"
                variant="macro"
                tone="ink"
                alt={artworkLabel}
              />

              {/* 技术标注：编号 + 引线，指向材料结构的不同区域 */}
              <div className="pointer-events-none absolute inset-0 hidden lg:block" aria-hidden="true">
                {principles.slice(0, CALLOUTS.length).map((_, i) => (
                  <div
                    key={i}
                    className="absolute flex items-center gap-2"
                    style={{ left: CALLOUTS[i].left, top: CALLOUTS[i].top }}
                  >
                    <span className="pv-num pv-mono text-[0.58rem] text-copper-300">
                      {ordinal(i)}
                    </span>
                    <span
                      className="block h-px bg-copper-300/60"
                      style={{ width: CALLOUTS[i].width }}
                    />
                  </div>
                ))}
              </div>
            </div>

            <p className="pv-mono mt-4 text-[0.58rem] text-muted">{artworkLabel}</p>
          </div>

          {/* 三条原则：编号 + 细线，不做卡片 */}
          <div className="col-span-12 lg:col-span-4">
            <ol>
              {principles.map((principle, i) => (
                <li
                  key={principle.title}
                  data-reveal
                  style={cssVars({ '--pv-delay': `${i * 90}ms` })}
                  className="border-t border-[var(--pv-rule)] py-6 first:border-t-0 first:pt-0"
                >
                  <div className="flex items-baseline gap-4">
                    <span className="pv-num pv-mono text-[0.6rem] text-copper-700">
                      {ordinal(i)}
                    </span>
                    <h3 className="text-[1rem] font-medium tracking-[-0.01em] text-navy-950">
                      {principle.title}
                    </h3>
                  </div>
                  <p className="mt-2 pl-8 text-[0.85rem] leading-relaxed text-muted">
                    {principle.desc}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </div>

        {/* 认证资质：如实说明现状，不展示任何证书图形 */}
        <div className="mt-20 grid grid-cols-12 gap-x-6 gap-y-4 border-t border-[var(--pv-rule)] pt-8">
          <h3 className="pv-mono col-span-12 text-[0.6rem] text-muted lg:col-span-3">
            {certificatesTitle}
          </h3>
          <p className="col-span-12 max-w-2xl text-[0.9rem] leading-relaxed text-navy-800 lg:col-span-8 lg:col-start-5">
            {certificatesNote}
          </p>
        </div>
      </PreviewContainer>
    </section>
  );
}
