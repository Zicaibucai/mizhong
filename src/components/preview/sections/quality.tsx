import { type Locale } from '@/lib/i18n';
import { MEDIA_SLOTS, getMediaBySlots } from '@/lib/media';
import type { PreviewCopy } from '@/lib/preview/content';
import { cssVars, ordinal } from '@/lib/preview/util';
import { PreviewMedia } from '../preview-media';
import { PreviewContainer, SectionHead } from '../shell';

/**
 * 质量与信任：通用供应链质量流程 + 材料细节。
 *
 * 上一版在大面积空白里放了一块「认证资质」区域，实际没有任何可展示的内容。
 * 这一版改为两条实打实的信息：
 *   1. 四条通用、可核对的供应链质量流程（规格确认 → 供应方与来料核验 →
 *      出货前检验 → 包装与单证复核），用编号 + 流程线紧凑呈现；
 *   2. 一个材料细节媒体位（后台绑定素材后自动替换织纹示意）。
 *
 * 关于证书：公司尚未确认任何认证资料，因此**不渲染任何证书图形或空框**，
 * 也不虚构任何证书、工厂、产能或检测数据。证书位（certificate.1/2/3）已经
 * 预留好：后台一旦上传真实素材，这里会自动出现缩略图；没有素材时只保留
 * 一句简短、如实的说明。
 */
export async function PreviewQuality({
  locale,
  index,
  eyebrow,
  title,
  subtitle,
  body,
  copy,
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
  copy: PreviewCopy;
  certificatesTitle: string;
  certificatesNote: string;
  artworkLabel: string;
}) {
  const certificates = await getMediaBySlots(
    [MEDIA_SLOTS.certificate1, MEDIA_SLOTS.certificate2, MEDIA_SLOTS.certificate3],
    locale,
  );
  const certificateList = Object.values(certificates).filter(
    (asset): asset is NonNullable<typeof asset> => Boolean(asset),
  );

  const steps = copy.qualitySteps;

  return (
    <section id="quality" className="pv-section relative bg-ivory-50">
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
            className="pv-lede mt-8 max-w-3xl text-[clamp(1rem,1.8vw,1.4rem)] text-navy-900/85"
          >
            {body}
          </p>
        ) : null}

        <div className="pv-head-gap grid grid-cols-12 gap-x-6 gap-y-9">
          {/* 左：四条通用质量流程，编号 + 流程线 */}
          <div className="col-span-12 lg:col-span-7">
            <p className="pv-mono text-[0.58rem] text-copper-700">{copy.qualityProcessLabel}</p>

            <ol className="mt-3">
              {steps.map((step, i) => (
                <li
                  key={step.title}
                  data-reveal
                  style={cssVars({ '--pv-delay': `${i * 70}ms` })}
                  className="pv-step"
                >
                  <span className="pv-step-node">
                    <span className="pv-num pv-mono text-[0.6rem] text-copper-700">
                      {ordinal(i)}
                    </span>
                  </span>

                  <div className="pb-1">
                    <h3 className="text-[0.95rem] font-medium tracking-[-0.01em] text-navy-950">
                      {step.title}
                    </h3>
                    <p className="mt-1.5 max-w-xl text-[0.84rem] leading-relaxed text-muted">
                      {step.desc}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          {/* 右：材料细节媒体位（未绑定素材时为克制的织纹示意） */}
          <div className="col-span-12 lg:col-span-5 lg:col-start-8" data-reveal="plate">
            <div className="pv-slot relative aspect-[4/3] w-full">
              <PreviewMedia
                slot={MEDIA_SLOTS.qualityImage}
                locale={locale}
                uid="quality-detail"
                variant="macro"
                tone="ink"
                alt={artworkLabel}
              />
            </div>
            <p className="pv-mono mt-3 text-[0.56rem] text-muted">{artworkLabel}</p>
          </div>
        </div>

        {/* 认证资质：如实说明现状；后台绑定证书素材后自动出现缩略图 */}
        <div className="mt-10 grid grid-cols-12 gap-x-6 gap-y-5 border-t border-[var(--pv-rule)] pt-6">
          <h3 className="pv-mono col-span-12 text-[0.6rem] text-muted lg:col-span-3">
            {certificatesTitle}
          </h3>

          <div className="col-span-12 lg:col-span-8 lg:col-start-5">
            <p className="max-w-2xl text-[0.88rem] leading-relaxed text-navy-800">
              {certificatesNote}
            </p>

            {certificateList.length > 0 ? (
              <ul className="mt-5 flex flex-wrap gap-3">
                {certificateList.map((asset) => (
                  <li key={asset.id}>
                    <a
                      href={asset.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="pv-slot block h-24 w-32 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-copper-500"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element -- 素材来自 OSS 动态域名，接入后统一切换到 next/image */}
                      <img
                        src={asset.thumbnailUrl || asset.url}
                        alt={asset.alt[locale] || asset.title[locale] || certificatesTitle}
                        loading="lazy"
                        className="h-full w-full object-cover"
                      />
                    </a>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
      </PreviewContainer>
    </section>
  );
}
