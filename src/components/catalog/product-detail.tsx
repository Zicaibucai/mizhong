import Link from 'next/link';
import { localeNames, type Locale } from '@/lib/i18n';
import { format, getCatalogDict } from '@/lib/i18n/catalog';
import type { ProductDetailView, ProductCardView } from '@/lib/catalog';
import type { ContactView } from '@/lib/content';
import { formatMoq, formatPrice, productUnitLabel } from '@/lib/product-format';
import { cn } from '@/lib/cn';
import { Container } from '@/components/ui/container';
import { ArrowRightIcon, MailIcon, PhoneIcon, WhatsAppIcon } from '@/components/ui/icons';
import {
  ProductMediaViewer,
  ProductSpecTable,
  ProductVariantTable,
} from '@/components/catalog/product-media-viewer';
import { ProductGrid } from '@/components/catalog/product-grid';
import { ProductInquiry } from '@/components/catalog/product-inquiry';
import { ProductVariantSelector } from '@/components/catalog/product-variant-selector';
import { catalogPath, withQuery } from '@/components/catalog/urls';

/**
 * 产品详情页正文（正式站与「草稿预览」共用同一份渲染）。
 *
 * 拆成组件的原因：后台的「预览产品」按钮必须能看到**未发布**的商品，
 * 而正式站只渲染已发布商品。两条路由的差异仅在于「取哪条数据 + 要不要显示草稿横幅」，
 * 版面必须完全一致，否则预览就失去意义 —— 所以正文只有这一份实现。
 */

/** 概要区的紧凑询盘按钮：与页脚的大块询盘区共用同一批联系方式 */
function SummaryInquiry({
  locale,
  contacts,
}: {
  locale: Locale;
  contacts: ContactView[];
}) {
  const dict = getCatalogDict(locale);

  const whatsapp = contacts.find((c) => c.type === 'WHATSAPP' && c.href);
  const email = contacts.find((c) => c.type === 'EMAIL' && c.href);
  const phone = contacts.find((c) => c.type === 'PHONE' && c.href);

  if (!whatsapp && !email && !phone) return null;

  const chip =
    'inline-flex h-10 max-w-full items-center gap-2 border border-navy-200 px-4 text-sm font-medium text-navy-800 transition-colors hover:border-copper-500 hover:bg-ivory-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-copper-500';

  return (
    <ul className="mt-3 flex flex-wrap gap-2">
      {whatsapp?.href ? (
        <li>
          <a href={whatsapp.href} target="_blank" rel="noopener noreferrer" className={chip}>
            <WhatsAppIcon className="h-4 w-4 shrink-0 text-[#25D366]" />
            {dict.detail.whatsapp}
          </a>
        </li>
      ) : null}
      {email?.href ? (
        <li>
          <a href={email.href} className={chip}>
            <MailIcon className="h-4 w-4 shrink-0 text-copper-600" />
            {dict.detail.email}
          </a>
        </li>
      ) : null}
      {phone?.href ? (
        <li>
          <a href={phone.href} className={chip}>
            <PhoneIcon className="h-4 w-4 shrink-0 text-navy-500" />
            <span className="truncate">{phone.value}</span>
          </a>
        </li>
      ) : null}
    </ul>
  );
}

export function ProductDetail({
  locale,
  product,
  contacts,
  related,
  variant = 'published',
}: {
  locale: Locale;
  product: ProductDetailView;
  contacts: ContactView[];
  related: ProductCardView[];
  /** draft = 后台预览未发布商品：顶部显示横幅，且不参与索引 */
  variant?: 'published' | 'draft';
}) {
  const dict = getCatalogDict(locale);

  const basePath = catalogPath(locale);
  const categoryHref = product.categorySlug
    ? withQuery(basePath, { category: product.categorySlug })
    : null;
  const overview = product.description?.trim() || product.shortDescription?.trim() || '';
  const freeTextSpec = product.spec?.trim() ?? '';
  const application = product.application?.trim() ?? '';
  const size = product.sizeSummary?.trim() || null;
  const moq = formatMoq(product.moq, product.moqUnit, locale);
  const price = formatPrice(product, locale);
  const unit = productUnitLabel(product.priceUnit, locale);
  const negotiable = product.priceMode === 'NEGOTIABLE' || !product.priceMin;

  // 主媒体列表已由数据层保证「封面在最前」，只设了封面没有图库的商品也有主图
  const galleryItems = product.media;

  return (
    <article className="bg-ivory-50 pb-16 pt-[4.25rem] lg:pb-24">
      {variant === 'draft' ? (
        <div className="border-b border-amber-200 bg-amber-50">
          <Container className="py-3">
            <p className="text-sm text-amber-900">{dict.detail.draftNotice}</p>
          </Container>
        </div>
      ) : null}

      {/* 面包屑 */}
      <Container className="border-b border-navy-200 py-5">
        <nav aria-label={dict.detail.breadcrumbProducts}>
          <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-navy-500">
            <li>
              <Link href={`/${locale}`} className="hover:text-copper-700">
                {dict.detail.breadcrumbHome}
              </Link>
            </li>
            <li aria-hidden className="text-navy-400">
              /
            </li>
            <li>
              <Link href={basePath} className="hover:text-copper-700">
                {dict.detail.breadcrumbProducts}
              </Link>
            </li>
            {product.categoryName && categoryHref ? (
              <>
                <li aria-hidden className="text-navy-400">
                  /
                </li>
                <li>
                  <Link href={categoryHref} className="hover:text-copper-700">
                    {product.categoryName}
                  </Link>
                </li>
              </>
            ) : null}
            <li aria-hidden className="text-navy-400">
              /
            </li>
            <li aria-current="page" className="min-w-0 max-w-full truncate font-medium text-navy-900">
              {product.name}
            </li>
          </ol>
        </nav>
      </Container>

      <Container className="mt-10 lg:mt-14">
        <div
          className={cn(
            'grid gap-10 lg:items-start lg:gap-16',
            galleryItems.length > 0
              ? 'lg:grid-cols-[minmax(0,1.2fr)_minmax(0,420px)]'
              : 'lg:grid-cols-[minmax(0,720px)]',
          )}
        >
          {/* 左：主媒体 + 缩略图 */}
          {galleryItems.length > 0 ? (
            <ProductMediaViewer
              locale={locale}
              items={galleryItems}
              hoverVideo={
                product.hoverVideoUrl
                  ? { url: product.hoverVideoUrl, posterUrl: product.hoverVideoPosterUrl }
                  : null
              }
              fallbackAlt={product.name}
              className="min-w-0"
            />
          ) : null}

          {/* 右：产品概要 */}
          <div
            className={cn(
              'min-w-0 border-t border-navy-200 pt-5',
              galleryItems.length > 0 && 'lg:sticky lg:top-20',
            )}
          >
            {product.categoryName ? (
              categoryHref ? (
                <Link
                  href={categoryHref}
                  className="pv-mono inline-flex w-fit text-[0.58rem] text-copper-700 transition-colors hover:text-copper-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-copper-500"
                >
                  {product.categoryName}
                </Link>
              ) : (
                <span className="pv-mono inline-flex w-fit text-[0.58rem] text-copper-700">
                  {product.categoryName}
                </span>
              )
            ) : null}

            <h1 className="pv-display mt-5 text-4xl text-navy-950 sm:text-5xl">
              {product.name}
            </h1>

            {product.sku ? (
              <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
                <span className="font-medium text-navy-700">{dict.detail.sku}</span>
                <span className="font-mono text-navy-800">{product.sku}</span>
              </p>
            ) : null}

            {product.shortDescription ? (
              <p className="mt-4 text-base leading-relaxed text-muted">{product.shortDescription}</p>
            ) : null}

            {/* 价格 / 贸易信息：未填写的行直接隐藏，不渲染空框 */}
            <dl className="mt-7 divide-y divide-navy-200 border-y border-navy-200">
              <div className="flex flex-wrap items-baseline justify-between gap-3 py-4">
                <dt className="text-sm text-navy-500">{dict.detail.priceLabel}</dt>
                <dd
                  className={
                    negotiable
                      ? 'text-lg font-medium text-navy-700'
                      : 'text-lg font-semibold tracking-tight text-copper-800'
                  }
                >
                  {price}
                </dd>
              </div>
              {unit ? (
                <div className="flex flex-wrap items-baseline justify-between gap-3 py-4">
                  <dt className="text-sm text-navy-500">{dict.detail.unitLabel}</dt>
                  <dd className="text-sm text-navy-900">{unit}</dd>
                </div>
              ) : null}
              {moq ? (
                <div className="flex flex-wrap items-baseline justify-between gap-3 py-4">
                  <dt className="text-sm text-navy-500">{dict.detail.moqLabel}</dt>
                  <dd className="text-sm text-navy-900">{moq}</dd>
                </div>
              ) : null}
              {size ? (
                <div className="flex flex-wrap items-baseline justify-between gap-3 py-4">
                  <dt className="text-sm text-navy-500">{dict.detail.sizeLabel}</dt>
                  <dd className="text-sm text-navy-900">{size}</dd>
                </div>
              ) : null}
            </dl>

            <ProductVariantSelector groups={product.variantGroups} />

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Link
                href="#inquiry"
                className="pv-btn pv-btn-solid h-12 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-copper-500"
              >
                {dict.detail.sendInquiry}
                <ArrowRightIcon className="ms-2 h-4 w-4 rtl:-scale-x-100" />
              </Link>
            </div>

            {/* 概要区直接给出 WhatsApp / Email / 电话，客户不必先滚到页尾 */}
            <SummaryInquiry locale={locale} contacts={contacts} />

            {product.fallbackLocale ? (
              <p className="mt-6 border border-copper-200 bg-copper-50 px-4 py-3 text-sm leading-relaxed text-copper-800">
                {/* 说清**正在显示哪一种语言**，而不是写死「英文」——
                    回退目标将来可能变，写死会让提示开始说谎 */}
                {format(dict.detail.fallbackNotice, {
                  language: localeNames[product.fallbackLocale],
                })}
              </p>
            ) : null}
          </div>
        </div>
      </Container>

      {/* 产品介绍 / 结构化规格 / 应用场景：全部为空时整个区块不渲染 */}
      {overview || product.specificationTable?.rows.length || product.specifications.length > 0 || freeTextSpec || application ? (
        <Container className="mt-14 lg:mt-20">
          <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:gap-x-16 lg:gap-y-14">
            {overview ? (
              <section className="border-t border-navy-200 pt-5 lg:col-span-2 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:gap-16">
                <h2 className="pv-mono text-[0.62rem] text-copper-700">
                  {dict.detail.overview}
                </h2>
                <p className="mt-4 whitespace-pre-line text-base leading-relaxed text-navy-800 lg:mt-0">
                  {overview}
                </p>
              </section>
            ) : null}

            {product.specificationTable?.rows.length || product.specifications.length > 0 ? (
              <section className="border-t border-navy-200 pt-5 lg:col-span-2 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:gap-16">
                <h2 className="pv-mono text-[0.62rem] text-copper-700">
                  {dict.detail.specs}
                </h2>
                <div>
                  {product.specificationTable?.rows.length ? (
                    <ProductVariantTable table={product.specificationTable} caption={dict.detail.specs} />
                  ) : (
                    <ProductSpecTable specs={product.specifications} caption={dict.detail.specs} />
                  )}
                  {freeTextSpec ? (
                    <p className="mt-6 whitespace-pre-line text-base leading-relaxed text-navy-800">
                      {freeTextSpec}
                    </p>
                  ) : null}
                </div>
              </section>
            ) : freeTextSpec ? (
              <section className="border-t border-navy-200 pt-5 lg:col-span-2 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:gap-16">
                <h2 className="pv-mono text-[0.62rem] text-copper-700">
                  {dict.detail.specs}
                </h2>
                <p className="mt-4 whitespace-pre-line text-base leading-relaxed text-navy-800 lg:mt-0">
                  {freeTextSpec}
                </p>
              </section>
            ) : null}

            {application ? (
              <section className="border-t border-navy-200 pt-5 lg:col-span-2 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:gap-16">
                <h2 className="pv-mono text-[0.62rem] text-copper-700">
                  {dict.detail.applications}
                </h2>
                <p className="mt-4 whitespace-pre-line text-base leading-relaxed text-navy-800 lg:mt-0">
                  {application}
                </p>
              </section>
            ) : null}
          </div>
        </Container>
      ) : null}

      {/* 图库：与顶部查看器相互独立，保证「所有图片」始终可访问（含无 JavaScript 时） */}
      {product.gallery.length > 1 ? (
        <Container className="mt-14 lg:mt-20">
          <p className="pv-mono text-[0.58rem] text-copper-700">MEDIA / GALLERY</p>
          <h2 className="pv-display mt-4 text-3xl text-navy-950 sm:text-4xl">
            {dict.detail.gallery}
          </h2>
          <ul className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {product.gallery.map((item) => {
              const label = item.alt.trim() || product.name;
              return (
                <li key={item.id}>
                  {item.type === 'video' && item.url ? (
                    <video
                      className="aspect-[4/3] w-full border border-navy-200/80 bg-navy-950 object-cover"
                      controls
                      preload="metadata"
                      poster={item.posterUrl?.trim() || undefined}
                      aria-label={label}
                    >
                      <source src={item.url} />
                    </video>
                  ) : item.url ? (
                    // 用原图而不是缩略图：这一批地址上面的主查看器已经加载过，浏览器直接命中缓存，
                    // 不会多花一个字节，但「全部显示」时看到的是完整清晰度而不是缩小版。
                    // eslint-disable-next-line @next/next/no-img-element -- 素材来自 OSS 动态域名，接入 next/image remotePatterns 后统一替换
                    <img
                      src={item.url}
                      alt={label}
                      loading="lazy"
                      className="aspect-[4/3] w-full border border-navy-200/80 bg-navy-950 object-contain"
                    />
                  ) : null}
                  {item.caption ? (
                    <p className="mt-2.5 text-sm leading-relaxed text-muted">{item.caption}</p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </Container>
      ) : null}

      <Container className="mt-16 lg:mt-20">
        <div id="inquiry" className="scroll-mt-24">
          <ProductInquiry locale={locale} product={product} contacts={contacts} />
        </div>
      </Container>

      {related.length > 0 ? (
        <Container className="mt-16 lg:mt-20">
          <p className="pv-mono text-[0.58rem] text-copper-700">RELATED / PRODUCTS</p>
          <h2 className="pv-display mt-4 text-3xl text-navy-950 sm:text-4xl">
            {dict.detail.relatedTitle}
          </h2>
          <p className="mt-2 text-sm text-muted">
            {product.categoryName
              ? format(dict.detail.relatedSubtitle, { category: product.categoryName })
              : dict.detail.relatedFallbackSubtitle}
          </p>
          <ProductGrid locale={locale} products={related} className="mt-10" />
        </Container>
      ) : null}

    </article>
  );
}
