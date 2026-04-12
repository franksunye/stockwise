import type { Metadata, Viewport } from "next";
import { brandCoreZhCN } from "@/content/brand-core.zh-CN";

export const rootMetadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || brandCoreZhCN.domain),
  icons: {
    icon: "/logo.png",
    apple: "/logo.png",
  },
  openGraph: {
    images: [
      {
        url: "/logo.png",
        width: 512,
        height: 512,
        alt: "ZISO AI",
      },
    ],
  },
  twitter: {
    images: ["/logo.png"],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "ZISO AI",
  },
  other: {
    "color-scheme": "dark",
  },
};

export const rootViewport: Viewport = {
  themeColor: "#050508",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};
