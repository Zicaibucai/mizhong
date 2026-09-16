import { getDictionary, type Locale } from '@/lib/i18n';
import type { CompanyView } from '@/lib/content';
import { Container } from '@/components/ui/container';
import { SectionHeading } from '@/components/ui/section-heading';

/** 把后台的多段文本按空行拆成段落；空行之外的换行保留（whitespace-pre-line） */
function paragraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((part) => part.trim())
    .filter(Boolean);
}

/**
 * 公司介绍（正式首页 /zh、/en、/vi）。
 *
 * 这是**独立于「页面与区块」系统**的一块内容，唯一数据来源是后台的公司资料：
 *   - tagline     → 导语
 *   - about       → 正文（支持多段）
 *   - positioning → 辅助文字（公司定位）
 *
 * 规则：
 *   - 任何字段为空即不渲染该字段对应的元素，不显示空框；
 *   - about 与 positioning 同时为空时整个区块不出现（front matter 由调用方判断，
 *     这里也再判断一次，避免被别处误用）；
 *   - 不用字典文案冒充公司介绍 —— 字典只提供标题与领域标签。
 */
export function CompanyAbout({
  locale,
  company,
  className,
}: {
  locale: Locale;
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
    <section className={className ?? 'border-y border-navy-100 bg-white py-20 lg:py-28'}>
      <Container>
        <div className="grid gap-12 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-16">
          <SectionHeading
            align="left"
            eyebrow={t.about.eyebrow}
            title={t.about.title}
            description={tagline || undefined}
          />

          <div className="lg:pt-2">
            {blocks.length > 0 ? (
              <div className="space-y-5">
                {blocks.map((block) => (
                  <p
                    key={block.slice(0, 40)}
                    className="whitespace-pre-line text-base leading-relaxed text-navy-800"
                  >
                    {block}
                  </p>
                ))}
              </div>
            ) : null}

            {positioning ? (
              <div className="mt-8 border-l-2 border-copper-300 pl-5">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-navy-400">
                  {t.about.positioningLabel}
                </p>
                <p className="mt-2 whitespace-pre-line text-base leading-relaxed text-navy-700">
                  {positioning}
                </p>
              </div>
            ) : null}
          </div>
        </div>
      </Container>
    </section>
  );
}
