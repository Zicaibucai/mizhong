import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { locales, defaultLocale } from '@/lib/i18n/config';

/** 不参与语言前缀重定向的路径（后台自带权限守卫） */
const BYPASS_PREFIXES = ['admin', 'api'];

/** 历史环境变量里曾保存过 HTTP 域名和公网 IP，统一收敛到正式 HTTPS 域名。 */
const LEGACY_PRODUCTION_HOSTS = new Set(['htd123.com', 'www.htd123.com', '47.238.7.93']);

/**
 * 解析对外可访问的站点 origin。
 *
 * 应用运行在 Nginx 反向代理之后，中间件里 `request.nextUrl` 使用的是应用自身的
 * 监听地址（如 http://localhost:3000），直接用它会生成浏览器无法访问的跳转地址。
 * 因此优先使用配置的站点地址；未配置时回落到已校验的转发头。
 */
function resolveOrigin(request: NextRequest): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) {
    try {
      const url = new URL(configured);
      if (url.protocol === 'http:' || url.protocol === 'https:') {
        if (LEGACY_PRODUCTION_HOSTS.has(url.hostname.toLowerCase())) {
          return 'https://htd123.com';
        }
        return url.origin;
      }
    } catch {
      // 配置非法则回落到请求头
    }
  }

  const forwardedHost = request.headers.get('x-forwarded-host') ?? request.headers.get('host');
  if (forwardedHost && /^[a-z0-9.-]+(:\d{1,5})?$/i.test(forwardedHost)) {
    const proto = request.headers.get('x-forwarded-proto') === 'https' ? 'https' : 'http';
    return `${proto}://${forwardedHost}`;
  }

  return request.nextUrl.origin;
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
