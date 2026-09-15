import { defaultLocale, isLocale } from '@/lib/i18n';
import { getBlock, getSiteContent } from '@/lib/content';
import { Hero } from '@/components/home/hero';
import { Capabilities } from '@/components/home/capabilities';
import { ProductsPreview } from '@/components/home/products-preview';
import { Supply } from '@/components/home/supply';
import { QualityTrust } from '@/components/home/quality-trust';
import { InquiryCta } from '@/components/home/inquiry-cta';

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const l = isLocale(locale) ? locale : defaultLocale;
  const content = await getSiteContent(l);

  const hero = getBlock(content, 'hero');
  const capabilities = getBlock(content, 'capabilities');
  const products = getBlock(content, 'products');
  const supply = getBlock(content, 'supply');
  const quality = getBlock(content, 'quality');
  const inquiry = getBlock(content, 'inquiry');

  return (
    <>
      {hero.enabled ? <Hero locale={l} block={hero} /> : null}
      {capabilities.enabled ? <Capabilities locale={l} block={capabilities} /> : null}
      {products.enabled ? <ProductsPreview locale={l} block={products} /> : null}
      {supply.enabled ? <Supply locale={l} block={supply} /> : null}
      {quality.enabled ? <QualityTrust locale={l} block={quality} /> : null}
      {inquiry.enabled ? (
        <InquiryCta locale={l} block={inquiry} contacts={content.contacts} />
      ) : null}
    </>
  );
}
