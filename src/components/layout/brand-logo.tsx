import { getMediaBySlot, MEDIA_SLOTS } from '@/lib/media';
import type { Locale } from '@/lib/i18n';
import { cn } from '@/lib/cn';

/**
 * 品牌 Logo（后台可配置）。
 * 通过语义化槽位 brand.logo 绑定素材；未上传 Logo 时返回 null，不渲染任何图片，
 * 由页面使用纯文字公司名保持身份识别。
 */
export async function BrandLogo({ locale, className }: { locale: Locale; className?: string }) {
  const asset = await getMediaBySlot(MEDIA_SLOTS.logo, locale);
  if (!asset || asset.type !== 'image') return null;

  return (
    // eslint-disable-next-line @next/next/no-img-element -- 素材来自 OSS，接入后切换到 next/image + remotePatterns
    <img src={asset.url} alt={asset.alt[locale]} className={cn('object-contain', className)} />
  );
}
