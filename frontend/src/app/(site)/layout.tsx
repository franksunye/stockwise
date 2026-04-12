import type { Metadata, Viewport } from "next";
import { AppDocumentShell } from "../AppDocumentShell";
import { rootMetadata, rootViewport } from "../root-layout-config";
import "../globals.css";

export const metadata: Metadata = rootMetadata;
export const viewport: Viewport = rootViewport;

export default function SiteRootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <AppDocumentShell htmlLang="en">{children}</AppDocumentShell>;
}
