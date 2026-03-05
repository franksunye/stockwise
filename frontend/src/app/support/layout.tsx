import type { Metadata } from "next";
import { brandCoreZhCN } from "@/content/brand-core.zh-CN";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata(brandCoreZhCN.domain, {
  title: "支持中心 | 知守 AI (ZISO AI)",
  description: "查看知守 AI 功能说明、通知设置、验证逻辑与常见问题。",
  path: "/support",
  keywords: ["知守AI支持中心", "AI复盘说明", "通知设置"],
});

export default function SupportLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

