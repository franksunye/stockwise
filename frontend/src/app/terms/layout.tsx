import type { Metadata } from "next";
import { brandCoreZhCN } from "@/content/brand-core.zh-CN";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata(brandCoreZhCN.domain, {
  title: "Terms of Service | ZISO AI",
  description: "Terms governing the use of ZISO AI analysis, briefings, and subscription services.",
  path: "/terms",
  locale: "en",
  alternateLocales: ["en", "ko", "es", "cn"],
  keywords: ["terms of service", "ZISO AI", "user agreement"],
});

export default function TermsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
