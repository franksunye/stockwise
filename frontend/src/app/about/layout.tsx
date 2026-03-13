import type { Metadata } from "next";
import { brandCoreZhCN } from "@/content/brand-core.zh-CN";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata(brandCoreZhCN.domain, {
  title: "关于我们 | 知守 AI (ZISO AI)",
  description: "了解知守 AI 的定位、价值主张、团队与执行方法。",
  path: "/about",
  locale: "zh",
  alternateLocales: ["zh", "en"],
  keywords: ["知守AI", "ZISO AI", "AI复盘", "股票分析助手"],
});

export default function AboutLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
