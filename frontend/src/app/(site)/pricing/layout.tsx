import type { Metadata } from "next";
import { brandCoreZhCN } from "@/content/brand-core.zh-CN";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata(brandCoreZhCN.domain, {
  title: "Pricing | ZISO AI",
  description: "Subscription plans for investors who want stronger nightly research and execution discipline.",
  path: "/pricing",
  locale: "en",
  alternateLocales: ["en", "ko", "es", "cn"],
  keywords: ["ZISO AI pricing", "Pro subscription", "Alpha plan"],
});

export default function PricingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
