import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { defaultLocale, isLocale, type Locale } from '@/lib/i18n';
import { getProductForPreview, listRelatedProducts } from '@/lib/catalog';
import { getSiteContent } from '@/lib/content';
import { getCurrentUser } from '@/lib/auth/session';
import { ProductDetail } from '@/components/catalog/product-detail';

/**
 * 草稿预览：/zh|en|vi/products/<slug>/preview
 *
 * 后台商品编辑器里的「预览产品」必须能看到**未发布**的商品 —— 直接指向正式详情页
 * 会命中 notFound()（正式页只取 published 商品），按钮等于永远 404。
 *
 * 因此这里单开一条路由：
 *   - 只对已登录管理员可见，其余人一律 notFound()（与不存在无法区分，不泄露草稿存在性）；
 *   - 与正式详情页**共用同一个 ProductDetail 组件**，版面完全一致；
 *   - `force-dynamic` + noindex：草稿不参与索引，也不会被 ISR 缓存；
 *   - 网址后缀改过时按草稿里的 slug 也能找到（见 `getProductForPreview`）。
 */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  robots: { index: false, follow: false, nocache: true },
};

export default async function ProductPreviewPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();

  // 管理员会话校验放在取数据之前：未登录时不查库、不区分「不存在」与「无权查看」
  const user = await getCurrentUser();
  if (!user) notFound();

  const l: Locale = isLocale(locale) ? locale : defaultLocale;
  // 用「正式 slug → 草稿 slug」两级查找：编辑器里改过网址后缀后，预览链接依然有效
  const product = await getProductForPreview(slug, l);
  if (!product) notFound();

  const [content, related] = await Promise.all([
    getSiteContent(l),
    listRelatedProducts({ id: product.id, categorySlug: product.categorySlug }, l, 3),
  ]);

  return (
    <ProductDetail
      locale={l}
      product={product}
      contacts={content.contacts}
      related={related}
      variant="draft"
    />
  );
}
