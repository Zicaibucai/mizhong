/**
 * 站点对外 origin 的统一解析（middleware 与 site-config 共用）。
 *
 * 这里只保留一份实现，是因为两处曾经各写一份、且不等价：middleware 在 Edge 运行时
 * 里跑，`NEXT_PUBLIC_SITE_URL` 是**构建时**烘焙进去的；site-config 在 Node 运行时跑，
 * 读的是**实时**环境变量。两边只要对环境变量的可见性出现差异，输出就会自相矛盾 ——
 * 典型症状是 canonical 已经是 HTTPS，而首页跳转仍把 http 写进 Location。
 *
 * 因此本模块的硬规则是：**正式域名永不产出 http origin**。
 * 站点已全站 HTTPS，回落到 http 只会让浏览器多跑一次明文跳转。
 */

/** 正式站点 origin：`http://`、`www`、公网 IP 等历史写法一律收敛到这里 */
export const PRODUCTION_ORIGIN = 'https://htd123.com';

/** 曾出现在环境变量或请求头里的生产主机名（不含端口、大小写不敏感） */
const PRODUCTION_HOSTNAMES = new Set(['htd123.com', 'www.htd123.com', '47.238.7.93']);

/** 去掉端口与结尾的点，供主机名比较使用 */
function bareHostname(host: string): string {
  return host.replace(/:\d{1,5}$/, '').replace(/\.$/, '').toLowerCase();
}

/** 是否为生产主机名（apex / www / 公网 IP） */
export function isProductionHost(host: string): boolean {
  return PRODUCTION_HOSTNAMES.has(bareHostname(host));
}

/**
 * Host 值能否安全拼进 Location。
 * 只接受主机名 / IPv4 + 可选端口，且必须以字母数字开头结尾 ——
 * 挡掉带路径、userinfo、CR/LF 的构造，以及 `.`、`-x` 这类会拼出非法地址的值，
 * 避免把请求头直接拼成开放跳转。
 */
export function isSafeHost(host: string): boolean {
  return /^[a-z0-9]([a-z0-9.-]*[a-z0-9])?(:\d{1,5})?$/i.test(host);
}

/**
 * 解析 `X-Forwarded-Proto`。
 *
 * 多级代理会把值写成列表（`https, http`），**第一段才是客户端到第一跳的协议**。
 * 旧写法用 `=== 'https'` 全等比较，遇到列表就判成 http —— 首页那次不安全跳转
 * 就是这么来的。取不到或值不认识时返回 undefined，交给调用方决定默认值。
 */
export function parseForwardedProto(value: string | null | undefined): 'http' | 'https' | undefined {
  const first = value?.split(',')[0]?.trim().toLowerCase();
  if (first === 'https') return 'https';
  if (first === 'http') return 'http';
  return undefined;
}

export type SiteOriginInput = {
  /** 配置的站点地址（NEXT_PUBLIC_SITE_URL）；未配置或非法时传空 */
  configured?: string;
  /** 请求头里的对外主机名（x-forwarded-host 优先，其次 host） */
  host?: string | null;
  /** 请求头里的协议（x-forwarded-proto） */
  proto?: string | null;
  /** 上面都不可用时的兜底（服务端渲染传正式域名，middleware 传请求自身的 origin） */
  fallback: string;
};

/**
 * 解析对外可访问的站点 origin。
 *
 * 顺序：配置的站点地址（生产主机名收敛到 PRODUCTION_ORIGIN）→ 已校验的转发头
 * → 调用方给的兜底值。
 */
export function resolveSiteOrigin({ configured, host, proto, fallback }: SiteOriginInput): string {
  const fromConfig = parseConfiguredOrigin(configured);
  if (fromConfig) return fromConfig;

  if (host && isSafeHost(host)) {
    // 生产主机名一律给 HTTPS，不看 X-Forwarded-Proto：即使这一跳真的来自明文 HTTP，
    // 把浏览器直接送到 HTTPS 也比原样传下去更安全。
    if (isProductionHost(host)) return PRODUCTION_ORIGIN;
    return `${parseForwardedProto(proto) ?? 'http'}://${host}`;
  }

  return fallback;
}

/** 解析配置的站点地址；非法（空、非 http/https、无法解析）时返回 undefined */
function parseConfiguredOrigin(configured: string | undefined): string | undefined {
  const raw = configured?.trim();
  if (!raw) return undefined;
  try {
    const url = new URL(raw);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return undefined;
    // 生产域名按主机名收敛，因此 `https://www.htd123.com`、`http://htd123.com:80`
    // 这类历史写法也会一并归到正式 origin，与跳转保持一致。
    if (isProductionHost(url.hostname)) return PRODUCTION_ORIGIN;
    return url.origin;
  } catch {
    // 例如漏写协议的 `htd123.com`，按未配置处理
    return undefined;
  }
}
