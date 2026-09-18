import { getMediaBySlot, MEDIA_SLOTS } from '@/lib/media';
import type { Locale } from '@/lib/i18n';
import { cn } from '@/lib/cn';

/**
 * 品牌 Logo（后台可配置）。
 * 通过语义化槽位 brand.logo 绑定素材；未上传 Logo 时使用随站点发布的正式商标，
 * 后台以后上传的新版本仍可覆盖本地兜底素材。
 */
export async function BrandLogo({ locale, className }: { locale: Locale; className?: string }) {
  const asset = await getMediaBySlot(MEDIA_SLOTS.logo, locale);
  const hasManagedLogo = asset?.type === 'image';
  const src = hasManagedLogo ? asset.url : '/mizhong-brand-mark.jpg';
  // 兜底商标的替代文本：只有中英两种写法，其余语言沿用英文。
  const alt = hasManagedLogo
    ? asset.alt[locale]
    : locale === 'zh'
      ? '米众新材料品牌标识'
      : 'Mizhong New Materials brand mark';

  return (
    // eslint-disable-next-line @next/next/no-img-element -- 素材来自 OSS，接入后切换到 next/image + remotePatterns
    <img
      src={src}
      alt={alt}
      {...(!hasManagedLogo ? { width: 405, height: 378 } : {})}
      className={cn(
        'object-contain',
        !hasManagedLogo && 'rounded-[2px] bg-white ring-1 ring-black/5',
        className,
      )}
    />
  );
}
