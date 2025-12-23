import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "StockWise X | AI 炒股决策系统",
  description: "极致简单的 AI 炒股决策工具",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
