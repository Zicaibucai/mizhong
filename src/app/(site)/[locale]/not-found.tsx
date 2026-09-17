import { getDictionary, defaultLocale, isLocale } from '@/lib/i18n';
import { Container } from '@/components/ui/container';
import { Button } from '@/components/ui/button';

export default async function NotFound({ params }: { params?: Promise<{ locale?: string }> }) {
  let locale = defaultLocale;
  try {
    const p = await params;
    if (p?.locale && isLocale(p.locale)) locale = p.locale;
  } catch {
    // 忽略参数解析失败，回退到默认语言
  }
  const t = getDictionary(locale);

  return (
    <div className="texture-weave-dark min-h-[70vh] bg-navy-950 pt-[4.25rem] text-ivory-50">
      <Container className="flex flex-col items-center py-24 text-center sm:py-32">
      <p className="pv-mono text-copper-300">ERROR / 404</p>
      <h1 className="pv-display mt-6 text-5xl sm:text-7xl">
        {t.notFound.title}
      </h1>
      <p className="mt-6 max-w-md text-navy-200">{t.notFound.description}</p>
      <Button href={`/${locale}`} variant="outlineLight" className="mt-8 !rounded-none">
        {t.notFound.back}
      </Button>
      </Container>
    </div>
  );
}
