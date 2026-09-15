import { defaultLocale, isLocale } from '@/lib/i18n';
import { Hero } from '@/components/home/hero';
import { Capabilities } from '@/components/home/capabilities';
import { ProductsPreview } from '@/components/home/products-preview';
import { Manufacturing } from '@/components/home/manufacturing';
import { QualityTrust } from '@/components/home/quality-trust';
import { InquiryCta } from '@/components/home/inquiry-cta';

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const l = isLocale(locale) ? locale : defaultLocale;

  return (
    <>
      <Hero locale={l} />
      <Capabilities locale={l} />
      <ProductsPreview locale={l} />
      <Manufacturing locale={l} />
      <QualityTrust locale={l} />
      <InquiryCta locale={l} />
    </>
  );
}
