import type { Metadata } from "next";
import { brandCoreZhCN } from "@/content/brand-core.zh-CN";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata(brandCoreZhCN.domain, {
  title: "系统状态 | 知守 AI (ZISO AI)",
  description: "查看知守 AI 数据同步、任务执行与系统健康状态。",
  path: "/status",
  keywords: ["系统状态", "AI任务执行", "服务可用性"],
});

export default function StatusLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

