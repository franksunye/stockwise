import type { Metadata } from "next";
import { brandCoreZhCN } from "@/content/brand-core.zh-CN";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata(brandCoreZhCN.domain, {
  title: "定价与订阅 | 知守 AI (ZISO AI)",
  description: "查看知守 AI 免费版与 Pro 版能力差异、订阅方案与计费说明。",
  path: "/pricing",
  keywords: ["知守AI定价", "AI炒股工具订阅", "Pro会员"],
});

export default function PricingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

