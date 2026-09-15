import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { locales, defaultLocale } from '@/lib/i18n/config';

/**
 * 将无语言前缀的路径重定向到默认语言，例如 `/` → `/zh`、`/products` → `/zh/products`。
 * 带合法语言前缀的请求直接放行。
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const first = pathname.split('/').filter(Boolean)[0] ?? '';
  const hasLocale = (locales as readonly string[]).includes(first);

  if (hasLocale) {
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();
  url.pathname = `/${defaultLocale}${pathname === '/' ? '' : pathname}`;
  return NextResponse.redirect(url, 308);
}

export const config = {
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
