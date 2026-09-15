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
    <Container className="flex flex-col items-center py-24 text-center sm:py-32">
      <p className="font-mono text-sm text-copper-600">404</p>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight text-navy-900 sm:text-4xl">
        {t.notFound.title}
      </h1>
      <p className="mt-4 max-w-md text-muted">{t.notFound.description}</p>
      <Button href={`/${locale}`} variant="primary" className="mt-8">
        {t.notFound.back}
      </Button>
    </Container>
  );
}
