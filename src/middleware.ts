import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { locales, defaultLocale } from '@/lib/i18n/config';
import { resolveSiteOrigin } from '@/lib/site-origin';

/** 不参与语言前缀重定向的路径（后台自带权限守卫） */
const BYPASS_PREFIXES = ['admin', 'api'];

/**
 * 解析对外可访问的站点 origin。
 *
 * 应用运行在 Nginx 反向代理之后，中间件里 `request.nextUrl` 使用的是应用自身的
 * 监听地址（如 http://localhost:3000），直接用它会生成浏览器无法访问的跳转地址。
 * 因此优先使用配置的站点地址；未配置时回落到已校验的转发头。
 *
 * 注意：中间件跑在 Edge 运行时，`process.env.NEXT_PUBLIC_SITE_URL` 是**构建时**
 * 烘焙进来的 —— 构建机器上没这个变量时，这里读到的是空值，只能走转发头。
 * 具体收敛规则（含「生产域名永不产出 http」）见 `@/lib/site-origin`。
 */
function resolveOrigin(request: NextRequest): string {
  return resolveSiteOrigin({
    configured: process.env.NEXT_PUBLIC_SITE_URL,
    host: request.headers.get('x-forwarded-host') ?? request.headers.get('host'),
    proto: request.headers.get('x-forwarded-proto'),
    fallback: request.nextUrl.origin,
  });
}

/**
 * 将无语言前缀的公开路径重定向到默认语言，例如 `/` → `/zh`、`/products` → `/zh/products`。
 * 带合法语言前缀的请求、以及后台/接口路径直接放行。
 */
export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const first = pathname.split('/').filter(Boolean)[0] ?? '';

  if ((locales as readonly string[]).includes(first)) {
    return NextResponse.next();
  }

  if (BYPASS_PREFIXES.includes(first)) {
    return NextResponse.next();
  }

  const suffix = pathname === '/' ? '' : pathname;
  return NextResponse.redirect(`${resolveOrigin(request)}/${defaultLocale}${suffix}${search}`, 308);
}

export const config = {
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
