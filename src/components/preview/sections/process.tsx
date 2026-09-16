import { type Locale } from '@/lib/i18n';
import { MEDIA_SLOTS } from '@/lib/media';
import { ordinal } from '@/lib/preview/util';
import { PreviewMedia } from '../preview-media';
import { PreviewContainer, SectionHead } from '../shell';

/**
 * 采购流程：受控高度的双栏紧凑阶段面板。
 *
 * 与上一版的关键差别：不再堆叠四个接近全屏的面板 —— 桌面每行约 230px，
 * 四个阶段加起了不到一屏半。左列是阶段索引（sticky 定位，随滚动停在视口中）
 * 与该区块预留的媒体位（后台绑定 supply.image 后自动换成真实图片），
 * 右列是四行紧凑的阶段说明，两者合起来正好填满版面，不留无信息的整屏空白。
 *
 * 四段文案全部来自既有三语言字典：
 *   阶段标题 ← supply.points
 *   阶段说明 ← capabilities.items（按流程先后重排，语义一一对应）
 *
 * 可读性优先：所有阶段文字都是**完整不透明**的浅色（非当前阶段用 navy-300，
 * 在 navy-950 上对比度约 7:1），当前阶段只通过铜色序号、生长出来的细线与图版提亮来标记。
 * 关闭 JS 时没有任何 data-active 属性，四个阶段同时以完整状态呈现。
 */
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
    <section
      id="supply"
      className="pv-section texture-weave-dark relative bg-navy-950 text-ivory-50"
    >
      <PreviewContainer>
        <SectionHead
          index={index}
          eyebrow={eyebrow}
          title={title}
          subtitle={subtitle}
          tone="dark"
          titleClassName="max-w-3xl"
          meta={<span className="pv-mono text-[0.6rem]">{stageLabel}</span>}
        />

        <div className="pv-head-gap grid grid-cols-12 gap-x-6 gap-y-8">
          {/* 左：sticky 阶段索引 + 该区块预留的媒体位（窄屏只保留阶段行） */}
          <div className="col-span-12 lg:col-span-4">
            <div className="lg:sticky lg:top-24">
              <p className="pv-mono text-[0.6rem] text-copper-300">{stageLabel}</p>

              <ol className="mt-3 hidden lg:block">
                {points.map((point, i) => (
                  <li
                    key={point}
                    data-stage-nav
                    data-stage-index={i}
                    className="pv-stage-nav-item"
                  >
                    <span
                      className="pv-stage-bar w-px self-stretch bg-copper-400"
                      aria-hidden="true"
                    />
                    <span className="pv-num pv-mono text-[0.6rem]">{ordinal(i)}</span>
                    <span className="text-[0.92rem] leading-snug">{point}</span>
                  </li>
                ))}
              </ol>

              {/* 预留媒体位：后台绑定 supply.image 后自动替换为真实素材 */}
              <div className="mt-8 hidden lg:block" data-reveal="plate">
                <div className="relative aspect-[4/5] w-full overflow-hidden">
                  <PreviewMedia
                    slot={MEDIA_SLOTS.supplyImage}
                    locale={locale}
                    uid="supply-plate"
                    variant="twill"
                    tone="ink"
                    alt={artworkLabel}
                  />
                </div>
                <p className="pv-mono mt-3 text-[0.56rem] text-navy-400">{artworkLabel}</p>
              </div>
            </div>
          </div>

          {/* 右：四个紧凑阶段行 */}
          <div className="col-span-12 lg:col-span-7 lg:col-start-6">
            {points.map((point, i) => {
              const capability = capabilities[CAPABILITY_FOR_STAGE[i] ?? i];

              return (
                <article
                  key={point}
                  data-stage-row
                  data-stage-index={i}
                  className="pv-stage-row grid grid-cols-12 items-center gap-x-5 gap-y-4"
                >
                  {/* 序号 + 标题 + 说明，作为一个整体阅读单元 */}
                  <div className="col-span-9 lg:col-span-12">
                    <div className="flex items-center gap-3">
                      <span className="pv-stage-no pv-num pv-mono text-[0.6rem]">
                        {ordinal(i)}
                      </span>
                      <span
                        className="pv-stage-rule h-px w-10 bg-copper-300/60"
                        aria-hidden="true"
                      />
                      <span className="pv-mono text-[0.55rem] text-navy-400">{stageLabel}</span>
                    </div>

                    <h3 className="pv-stage-title pv-display mt-3 text-[clamp(1.05rem,1.7vw,1.5rem)]">
                      {point}
                    </h3>

                    {capability?.desc ? (
                      <p className="mt-2.5 max-w-xl text-[0.82rem] leading-relaxed text-navy-200">
                        {capability.desc}
                      </p>
                    ) : null}

                    {capability?.title ? (
                      <p className="pv-mono mt-3 text-[0.55rem] text-navy-400">
                        {capability.title}
                      </p>
                    ) : null}
                  </div>

                  {/* 窄屏保留一枚 72px 见方的织纹示意，桌面由左列的整幅材料图承担 */}
                  <div className="col-span-3 lg:hidden">
                    <div className="pv-stage-figure relative aspect-square w-full overflow-hidden">
                      <PreviewMedia
                        slot={MEDIA_SLOTS.supplyImage}
                        locale={locale}
                        uid={`stage-${i}`}
                        variant={STAGE_VARIANTS[i % STAGE_VARIANTS.length]}
                        tone={STAGE_TONES[i % STAGE_TONES.length]}
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

/** 阶段顺序 → capabilities.items 的下标（供应商筛选 / 规格确认 / 检验 / 出货） */
const CAPABILITY_FOR_STAGE = [1, 0, 2, 3] as const;

/** 窄屏小方图的织纹结构与色调 */
const STAGE_VARIANTS = ['plain', 'twill', 'macro', 'rib'] as const;
const STAGE_TONES = ['ink', 'sand', 'ink', 'ivory'] as const;
