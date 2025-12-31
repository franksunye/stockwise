import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "StockWise X | AI 炒股决策系统",
  description: "极致简单的 AI 炒股决策工具",
  manifest: "/manifest.json",
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
        {children}
      </body>
    </html>
  );
}
