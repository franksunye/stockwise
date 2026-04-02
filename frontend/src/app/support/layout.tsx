import type { Metadata } from "next";
import { brandCoreZhCN } from "@/content/brand-core.zh-CN";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata(brandCoreZhCN.domain, {
  title: "Support Center | ZISO AI",
  description: "Get help with ZISO AI analysis, account management, and investment workflow.",
  path: "/support",
  locale: "en",
  alternateLocales: ["en", "ko", "es", "cn"],
  keywords: ["ZISO AI support", "help center", "customer care"],
});

export default function SupportLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
