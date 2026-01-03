import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "StockWise X | AI 炒股决策系统",
  description: "极致简单的 AI 炒股决策工具",
  manifest: "/manifest.json",
  icons: {
    icon: "/logo.png",
    apple: "/logo.png",
  },
  openGraph: {
    title: "StockWise X | AI 炒股决策系统",
    description: "极致简单的 AI 炒股决策工具，实时监控、深度复盘、智能决策",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "StockWise X - AI 驱动的炒股决策系统",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "StockWise X | AI 炒股决策系统",
    description: "极致简单的 AI 炒股决策工具",
    images: ["/og-image.png"],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "StockWise X",
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">
        <PerformanceOptimizer />
        <ReferralTracker />
        <BadgeManager />
        {children}
      </body>
    </html>
  );
}
