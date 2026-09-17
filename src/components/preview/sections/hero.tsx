import { type Locale } from '@/lib/i18n';
import { ArrowRightIcon } from '@/components/ui/icons';
import { cn } from '@/lib/cn';
import { cssVars, ordinal, splitLines } from '@/lib/preview/util';
import { FibreField } from '../fibre-field';
import { PreviewContainer } from '../shell';

/**
 * 首屏：接近满屏的编辑式开场。
 *
 * 无真实照片时的完整性由四层构成：
 *   1. 纤维场画布（随指针与滚动克制运动）
 *   2. 十二栏细线网格（极低对比的秩序感）
 *   3. 超大分行标题（逐行遮罩上浮，加载即播放）
 *   4. 右侧材料分类索引 + 底部滚动提示
 * 不出现任何「媒体占位 / 待上传」字样，也不使用任何伪造影像。
 *
 * 高度用 clamp(34rem, 86svh, 90svh)（见 preview.css 的 .pv-hero）：
 * 手机上不至于顶掉下一屏，桌面上仍保留开场气势，同时不留整屏空档。
 */
export function PreviewHero({
  locale,
  eyebrow,
  title,
  subtitle,
  primaryLabel,
  primaryHref,
  secondaryLabel,
  secondaryHref,
  categories,
  categoryHref,
  indexLabel,
  scrollLabel,
}: {
  locale: Locale;
  eyebrow: string;
  title: string;
  subtitle: string;
  primaryLabel: string;
  primaryHref: string;
  secondaryLabel: string;
  secondaryHref: string;
  categories: ReadonlyArray<{ name: string; desc: string }>;
  /** 分类索引的落点（产品目录） */
  categoryHref: string;
  indexLabel: string;
  scrollLabel: string;
}) {
  const lines = splitLines(title);
  // 中文单字即为一个方块，与拉丁文的字宽差异很大，分行标题的字号需要按语言取值，
  // 否则中文标题会在词组中间断行。
  const sizeClass =
    locale === 'zh'
      ? 'text-[clamp(1.75rem,5.6vw,5.2rem)]'
      : 'text-[clamp(1.65rem,4.8vw,4.4rem)]';

  return (
    <section
      id="hero"
      data-pv-hero
      className="pv-hero relative isolate flex flex-col overflow-hidden bg-navy-950 text-ivory-50"
    >
      {/* 背景层：纤维场 + 暗角 */}
      <div className="absolute inset-0 -z-10">
        <FibreField className="absolute inset-0 h-full w-full" />
        <div
          data-parallax
          style={cssVars({ '--pv-parallax': 0.05 })}
          className="absolute inset-0 bg-[radial-gradient(130%_100%_at_20%_15%,transparent_0%,rgba(22,10,13,0.30)_55%,rgba(22,10,13,0.82)_100%)]"
        />
      </div>

      <PreviewContainer className="relative flex flex-1 flex-col justify-between gap-8 pb-10 pt-28 sm:pt-32 lg:pb-12 lg:pt-32">
        {/* 十二栏细线：与内容栅格严格对齐，作为版面的秩序基线 */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-6 right-6 hidden grid-cols-12 gap-x-6 sm:left-10 sm:right-10 sm:grid lg:left-14 lg:right-14"
        >
          {Array.from({ length: 12 }, (_, i) => (
            <div
              key={i}
              className={cn(
                'border-l border-ivory-50/[0.07]',
                i === 11 && 'border-r border-r-ivory-50/[0.07]',
              )}
            />
          ))}
        </div>

        {/* 顶部：领域标注 */}
        <div
          className="pv-load relative flex items-center gap-5 text-copper-300"
          style={cssVars({ '--pv-delay': '60ms' })}
        >
          <span className="pv-num pv-mono">01</span>
          <span className="h-px w-14 bg-copper-300/40" />
          <span className="pv-mono text-[0.62rem]">{eyebrow}</span>
        </div>

        {/* 主体：超大分行标题 + 右侧材料索引（同一视觉带） */}
        <div className="relative grid grid-cols-12 items-start gap-x-6 gap-y-10">
          <div className="col-span-12 lg:col-span-8">
            <h1 className={cn('pv-display', sizeClass)}>
              {lines.map((line, i) => (
                <span
                  key={line}
                  className="pv-mask"
                  style={cssVars({ '--pv-delay': `${150 + i * 110}ms` })}
                >
                  <span>{line}</span>
                </span>
              ))}
            </h1>

            <p
              className="pv-load mt-7 max-w-xl text-[0.95rem] leading-relaxed text-navy-200"
              style={cssVars({ '--pv-delay': '120ms' })}
            >
              {subtitle}
            </p>

            <div
              className="pv-load mt-8 flex flex-wrap gap-3"
              style={cssVars({ '--pv-delay': '200ms' })}
            >
              <a href={primaryHref} className="pv-btn pv-btn-solid">
                <span>{primaryLabel}</span>
                <ArrowRightIcon className="pv-arrow h-4 w-4" />
              </a>
              <a href={secondaryHref} className="pv-btn pv-btn-line">
                <span>{secondaryLabel}</span>
                <ArrowRightIcon className="pv-arrow h-4 w-4" />
              </a>
            </div>
          </div>

          {/* 索引：真实分类，编号编排 —— 既是内容也是版面秩序 */}
          <div
            className="pv-load col-span-12 lg:col-span-3 lg:col-start-10"
            style={cssVars({ '--pv-delay': '260ms' })}
          >
            <p className="pv-mono mb-2.5 text-[0.6rem] text-navy-300">{indexLabel}</p>
            <ul>
              {categories.map((category, i) => (
                <li key={category.name}>
                  <a
                    href={categoryHref}
                    className="group flex items-baseline gap-4 border-t border-[var(--pv-rule-dark)] py-1.5"
                  >
                    <span className="pv-num pv-mono text-[0.6rem] text-copper-300/70">
                      {ordinal(i)}
                    </span>
                    <span className="text-[0.78rem] text-navy-100/75 transition-colors group-hover:text-ivory-50">
                      {category.name}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* 底部基线：细线收口，再接滚动提示 */}
        <div className="pv-load relative" style={cssVars({ '--pv-delay': '320ms' })}>
          <div className="h-px w-full bg-[var(--pv-rule-dark)]" />
          <div className="mt-4 flex items-center gap-4">
            <span className="pv-scrollcue relative block h-6 w-px bg-ivory-50/15" />
            <span className="pv-mono text-[0.58rem] text-navy-300">{scrollLabel}</span>
          </div>
        </div>
      </PreviewContainer>
    </section>
  );
}
