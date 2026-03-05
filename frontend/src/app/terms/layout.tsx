import type { Metadata } from "next";
import { brandCoreZhCN } from "@/content/brand-core.zh-CN";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata(brandCoreZhCN.domain, {
  title: "服务条款 | 知守 AI (ZISO AI)",
  description: "知守 AI 服务条款与使用规则。",
  path: "/terms",
  keywords: ["服务条款", "知守AI", "使用协议"],
});

export default function TermsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

