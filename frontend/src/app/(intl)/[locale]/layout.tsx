import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { AppDocumentShell } from "../../AppDocumentShell";
import { rootMetadata, rootViewport } from "../../root-layout-config";
import { getHtmlLang, isSupportedPublicLocale } from "@/lib/public-i18n";
import "../../globals.css";

export const metadata: Metadata = rootMetadata;
export const viewport: Viewport = rootViewport;

type LocaleLayoutProps = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export default async function LocaleRootLayout({
  children,
  params,
}: LocaleLayoutProps) {
  const { locale } = await params;
  if (!isSupportedPublicLocale(locale)) {
    notFound();
  }

  return <AppDocumentShell htmlLang={getHtmlLang(locale)}>{children}</AppDocumentShell>;
}
