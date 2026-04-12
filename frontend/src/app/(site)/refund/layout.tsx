import type { Metadata } from "next";
import { brandCoreZhCN } from "@/content/brand-core.zh-CN";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata(brandCoreZhCN.domain, {
  title: "Refund Policy | ZISO AI",
  description: "Refund policy for first-time Pro subscribers and billing support flows.",
  path: "/refund",
  locale: "en",
  alternateLocales: ["en", "ko", "es", "cn"],
  keywords: ["refund policy", "ZISO AI", "subscription refund"],
});

export default function RefundLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
