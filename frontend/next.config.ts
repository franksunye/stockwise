import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['better-sqlite3'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'api.multiavatar.com',
        port: '',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
