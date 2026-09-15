/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // 安全响应头（生产基线；严格 CSP 待域名/CDN 确定后再收紧）
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
    ];
  },
  // TODO(部署阶段)：素材接入阿里云 OSS 后，配置 images.remotePatterns 以启用 next/image 优化
  // images: {
  //   remotePatterns: [
  //     { protocol: 'https', hostname: '**.aliyuncs.com' },
  //     { protocol: 'https', hostname: 'cdn.example.com' },
  //   ],
  // },
};

export default nextConfig;
