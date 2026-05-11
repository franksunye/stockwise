import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: '/dashboard/tools/position-budget',
        destination: '/tools/position-budget',
        permanent: false,
      },
    ];
  },
  serverExternalPackages: ['better-sqlite3'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'api.multiavatar.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'api.producthunt.com',
        port: '',
        pathname: '/**',
      },
    ],
  },

  // ── 工业级缓存头配置 ──
  // Service Worker 文件必须禁止浏览器缓存，否则用户可能永远卡在旧版本。
  // 这是 Google 官方 PWA 最佳实践的强制要求。
  // See: https://web.dev/articles/service-worker-lifecycle#avoid_changing_the_url
  async headers() {
    return [
      {
        // sw.js 必须每次从服务器获取最新版本
        source: '/sw.js',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-cache, no-store, must-revalidate',
          },
          {
            key: 'Content-Type',
            value: 'application/javascript; charset=utf-8',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
