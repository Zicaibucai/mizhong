import { type Locale } from '@/lib/i18n';
import { MEDIA_SLOTS } from '@/lib/media';
import { ordinal } from '@/lib/preview/util';
import type { WeaveVariant } from '../textile-artwork';
import { PreviewMedia } from '../preview-media';
import { ProcessIndex } from '../process-index';
import { PreviewContainer, SectionHead } from '../shell';

/**
 * 采购流程：sticky 分阶段滚动叙事。
 *
 * 左列是「阶段索引」，随滚动停在视口中；右列是四个高面板，越过屏幕中线时点亮。
 * 不使用四宫格 —— 阶段之间有明确的先后关系，版面就应该是一条向下的路径。
 *
 * 文案全部来自既有三语言字典：
 *   阶段标题 ← supply.points
 *   阶段说明 ← capabilities.items（按流程先后重排，语义一一对应）
 */
interface StageSpec {
  variant: WeaveVariant;
  tone: 'navy' | 'ink' | 'ivory' | 'sand';
  /** 面板的图形比例，制造纵向节奏变化 */
  aspect: string;
}

const STAGE_SPECS: readonly StageSpec[] = [
  { variant: 'plain', tone: 'ink', aspect: 'aspect-[4/5]' },
  { variant: 'twill', tone: 'sand', aspect: 'aspect-[4/3]' },
  { variant: 'macro', tone: 'ink', aspect: 'aspect-square' },
  { variant: 'rib', tone: 'ivory', aspect: 'aspect-[3/2]' },
];

/** 阶段顺序 → capabilities.items 的下标（供应商筛选 / 规格确认 / 检验 / 出货） */
const CAPABILITY_FOR_STAGE = [1, 0, 2, 3] as const;

export function PreviewProcess({
  locale,
  index,
  eyebrow,
  title,
  subtitle,
  stageLabel,
  points,
  capabilities,
  artworkLabel,
}: {
  locale: Locale;
  index: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  stageLabel: string;
  points: readonly string[];
  capabilities: ReadonlyArray<{ title: string; desc: string }>;
  artworkLabel: string;
}) {
  return (
    <section id="supply" className="texture-weave-dark relative bg-navy-950 py-24 text-ivory-50 lg:py-32">
      <PreviewContainer>
        <SectionHead
          index={index}
          eyebrow={eyebrow}
          title={title}
          subtitle={subtitle}
          tone="dark"
          titleClassName="max-w-3xl"
        />

        <div className="mt-20 grid grid-cols-12 gap-x-6 gap-y-14">
          {/* 左：sticky 阶段索引（窄屏隐藏，面板自带序号与标题） */}
          <div className="col-span-12 lg:col-span-4">
            <ProcessIndex stages={[...points]} label={stageLabel} />
          </div>

          {/* 右：四个阶段面板 */}
          <div className="col-span-12 lg:col-span-8">
            {points.map((point, i) => {
              const spec = STAGE_SPECS[i % STAGE_SPECS.length];
              const capability = capabilities[CAPABILITY_FOR_STAGE[i] ?? i];

              return (
                <article
                  key={point}
                  data-stage-panel
                  data-stage-index={i}
                  data-active={i === 0 ? 'true' : 'false'}
                  className="pv-panel grid grid-cols-12 items-center gap-x-6 gap-y-8 border-t border-[var(--pv-rule-dark)] py-14 lg:min-h-[68vh] lg:py-16"
                >
                  {/* 左：阶段序号 + 标题 + 说明，作为一个整体阅读单元 */}
                  <div className="col-span-12 lg:col-span-6">
                    <div className="flex items-center gap-4">
                      <span className="pv-num pv-mono text-[0.6rem] text-copper-300">
                        {ordinal(i)}
                      </span>
                      <span className="h-px w-10 bg-copper-300/40" />
                      <span className="pv-mono text-[0.58rem] text-navy-300">{stageLabel}</span>
                    </div>

                    <h3 className="pv-display mt-6 text-[clamp(1.35rem,2.8vw,2.3rem)] text-ivory-50">
                      {point}
                    </h3>

                    {capability?.desc ? (
                      <p className="mt-5 max-w-md text-[0.9rem] leading-relaxed text-navy-200">
                        {capability.desc}
                      </p>
                    ) : null}

                    {capability?.title ? (
                      <p className="pv-mono mt-7 text-[0.58rem] text-navy-400">{capability.title}</p>
                    ) : null}
                  </div>

                  {/* 右：该阶段的织纹示意 */}
                  <div className="col-span-12 lg:col-span-5 lg:col-start-8">
                    <div className={`pv-panel-figure relative w-full overflow-hidden ${spec.aspect}`}>
                      <PreviewMedia
                        slot={MEDIA_SLOTS.supplyImage}
                        locale={locale}
                        uid={`stage-${i}`}
                        variant={spec.variant}
                        tone={spec.tone}
                        alt={artworkLabel}
                      />
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </PreviewContainer>
    </section>
  );
}
