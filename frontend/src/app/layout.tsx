import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"),
  title: "ZISO AI | AI 炒股决策系统",
  description: "极致简单的 AI 炒股决策工具",
  manifest: "/manifest.json",
  icons: {
    icon: "/logo.png",
    apple: "/logo.png",
  },
  openGraph: {
    title: "ZISO AI | AI 炒股决策系统",
    description: "极致简单的 AI 炒股决策工具，实时监控、深度复盘、智能决策",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "ZISO AI - AI 驱动的炒股决策系统",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "ZISO AI | AI 炒股决策系统",
    description: "极致简单的 AI 炒股决策工具",
    images: ["/og-image.png"],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "ZISO AI",
  },
};

export const viewport: Viewport = {
  themeColor: "#050508",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

import { ReferralTracker } from "@/components/ReferralTracker";
import { PerformanceOptimizer } from "@/components/PerformanceOptimizer";
import { BadgeManager } from "@/components/BadgeManager";
import { Analytics } from "@vercel/analytics/react";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <head>
        {/* 高级工程优化：预连接应用子域名和核心资源，极大减少移动端握手延迟 */}
        <link rel="preconnect" href="https://app.ziso.cc" />
        <link rel="dns-prefetch" href="https://app.ziso.cc" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://va.vercel-scripts.com" />
      </head>
      <body className="antialiased">
        <PerformanceOptimizer />
        <ReferralTracker />
        <BadgeManager />
        {children}
        <Analytics />
      </body>
    </html>
  );
}
