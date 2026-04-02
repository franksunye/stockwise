import type { Metadata } from "next";
import { brandCoreZhCN } from "@/content/brand-core.zh-CN";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata(brandCoreZhCN.domain, {
  title: "Privacy Policy | ZISO AI",
  description: "Privacy and data handling policy for the ZISO AI public website.",
  path: "/privacy",
  locale: "en",
  alternateLocales: ["en", "ko", "es", "cn"],
  keywords: ["privacy policy", "ZISO AI", "data security"],
});

export default function PrivacyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
