import type { Metadata } from "next";
import { brandCoreZhCN } from "@/content/brand-core.zh-CN";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata(brandCoreZhCN.domain, {
  title: "退款政策 | 知守 AI (ZISO AI)",
  description: "查看知守 AI 退款条件、处理流程与到账说明。",
  path: "/refund",
  keywords: ["退款政策", "知守AI订阅", "售后支持"],
});

export default function RefundLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

