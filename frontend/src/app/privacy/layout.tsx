import type { Metadata } from "next";
import { brandCoreZhCN } from "@/content/brand-core.zh-CN";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata(brandCoreZhCN.domain, {
  title: "隐私政策 | 知守 AI (ZISO AI)",
  description: "知守 AI 隐私政策与数据处理说明。",
  path: "/privacy",
  locale: "zh",
  alternateLocales: ["zh", "en"],
  keywords: ["隐私政策", "知守AI", "数据安全"],
});

export default function PrivacyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
