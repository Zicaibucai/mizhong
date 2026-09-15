import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { locales, defaultLocale } from '@/lib/i18n/config';

/** 不参与语言前缀重定向的路径（后台自带权限守卫） */
const BYPASS_PREFIXES = ['admin', 'api'];

/**
 * 将无语言前缀的公开路径重定向到默认语言，例如 `/` → `/zh`、`/products` → `/zh/products`。
 * 带合法语言前缀的请求、以及后台/接口路径直接放行。
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const first = pathname.split('/').filter(Boolean)[0] ?? '';

  if ((locales as readonly string[]).includes(first)) {
    return NextResponse.next();
  }

  if (BYPASS_PREFIXES.includes(first)) {
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();
  url.pathname = `/${defaultLocale}${pathname === '/' ? '' : pathname}`;
  return NextResponse.redirect(url, 308);
}

export const config = {
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
