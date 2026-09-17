import { defaultLocale, isLocale } from '@/lib/i18n';
import { PreviewHome } from '@/components/preview/home';

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const l = isLocale(locale) ? locale : defaultLocale;
  return <PreviewHome locale={l} />;
}
