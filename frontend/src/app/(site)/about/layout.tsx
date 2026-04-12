import type { Metadata } from "next";
import { brandCoreZhCN } from "@/content/brand-core.zh-CN";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata(brandCoreZhCN.domain, {
  title: "About ZISO AI",
  description: "Why ZISO AI exists, how it frames research, and how the workflow is structured.",
  path: "/about",
  locale: "en",
  alternateLocales: ["en", "ko", "es", "cn"],
  keywords: ["ZISO AI", "AI research", "market briefing", "investor discipline"],
});

export default function AboutLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
