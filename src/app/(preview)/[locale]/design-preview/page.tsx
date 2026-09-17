import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { defaultLocale, isLocale, type Locale } from '@/lib/i18n';
import { PreviewHome } from '@/components/preview/home';

/**
 * 高端动态首页设计预览 —— /zh|en|vi/design-preview
 *
 * Preview 2.0 的 noindex 评审入口。正式首页与该路由共用 PreviewHome，
 * 因此评审结果与正式站不会再分叉。
 *
 * 内容来源与正式首页完全一致（数据库优先、字典回退），因此三种语言的文案、
 * 公司资料（name / tagline / about / positioning）与联系方式都是后台的真实内容，
 * 不引入任何未经确认的事实、数据、证书或影像。
 * 产品区读取后台**已发布**的商品；后台还没有已发布商品时退回产品分类概览。
 *
 * 不参与索引：路由不在 sitemap 中、不在导航中，metadata 设置 noindex。
 * 该页面为纯展示预览，不写库、不改动任何现有数据。
 */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  robots: { index: false, follow: false, nocache: true },
};

export default async function DesignPreviewPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const l: Locale = isLocale(locale) ? locale : defaultLocale;
  return <PreviewHome locale={l} />;
}
