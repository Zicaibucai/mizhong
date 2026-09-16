import type { Locale } from '@/lib/i18n';
import { getDictionary } from '@/lib/i18n';
import type { CompanyView } from '@/lib/content';
import { cssVars } from '@/lib/preview/util';
import { PreviewContainer, SectionHead } from '../shell';

/** 把后台的多段文本按空行拆段 */
function paragraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((part) => part.trim())
    .filter(Boolean);
}

/**
 * 公司介绍（设计预览版）。
 *
 * **与正式首页读的是同一份后台公司资料**（CompanyProfile 当前语言）：
 *   about → 正文，positioning → 辅助文字，tagline → 导语。
 *
 * 之前预览页只用了公司名与 tagline，正文完全来自写死的 preview 文案；
 * 现在正文只来自数据库，字段为空就不渲染对应元素，两者都为空时整块不出现。
 *
 * 版式沿用预览页的编辑式语汇：超大导语 + 十二栏栅格，动效仍由
 * ScrollChoreography 统一驱动（关闭 JS / reduced-motion 下内容默认可见）。
 */
export function PreviewAbout({
  locale,
  index,
  company,
  className,
}: {
  locale: Locale;
  index: string;
  company: CompanyView;
  className?: string;
}) {
  const t = getDictionary(locale);

  const about = company.about.trim();
  const positioning = company.positioning.trim();
  const tagline = company.tagline.trim();

  if (!about && !positioning) return null;

  const blocks = paragraphs(about);

  return (
    <section id="about" className={className ?? 'pv-section relative bg-ivory-100'}>
      <PreviewContainer>
        <SectionHead
          index={index}
          eyebrow={t.about.eyebrow}
          title={t.about.title}
          subtitle={tagline || undefined}
          titleClassName="max-w-3xl"
        />

        <div className="pv-head-gap grid grid-cols-12 gap-x-6 gap-y-10">
          <div className="col-span-12 lg:col-span-7">
            {blocks.map((block, i) => (
              <p
                key={block.slice(0, 40)}
                data-reveal
                className={
                  i === 0
                    ? 'pv-display whitespace-pre-line text-[clamp(1.05rem,1.9vw,1.5rem)] text-navy-900/90'
                    : 'mt-6 whitespace-pre-line text-[0.95rem] leading-relaxed text-navy-800/90'
                }
                style={cssVars({ '--pv-delay': `${i * 80}ms` })}
              >
                {block}
              </p>
            ))}
          </div>

          {positioning ? (
            <div className="col-span-12 lg:col-span-4 lg:col-start-9">
              <div
                data-reveal
                className="border-t pt-5"
                style={{ borderColor: 'var(--pv-rule-strong)' }}
              >
                <p className="pv-mono text-[0.58rem] text-copper-700">
                  {t.about.positioningLabel}
                </p>
                <p className="mt-3 whitespace-pre-line text-[0.9rem] leading-relaxed text-navy-800">
                  {positioning}
                </p>
              </div>
            </div>
          ) : null}
        </div>
      </PreviewContainer>
    </section>
  );
}
