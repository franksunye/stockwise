import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/react";
import { brandCoreZhCN } from "@/content/brand-core.zh-CN";
import { buildCanonicalUrl } from "@/lib/seo";
import "./globals.css";

const homeTitle = "知守 AI (ZISO AI) | AI 做功课，你做决策";
const homeDescription = brandCoreZhCN.positioning.text;

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"),
  title: homeTitle,
  description: homeDescription,
  manifest: "/manifest.json",
  icons: {
    icon: "/logo.png",
    apple: "/logo.png",
  },
  alternates: {
    canonical: buildCanonicalUrl(brandCoreZhCN.domain, "/"),
  },
  openGraph: {
    title: homeTitle,
    description: homeDescription,
    type: "website",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "ZISO AI",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: homeTitle,
    description: homeDescription,
    images: ["/og-image.png"],
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

export const viewport: Viewport = {
  themeColor: "#050508",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <head>
        <link rel="preconnect" href="https://app.ziso.cc" />
        <link rel="dns-prefetch" href="https://app.ziso.cc" />
        <link rel="preconnect" href="https://va.vercel-scripts.com" />
      </head>
      <body className="antialiased">
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var ua = window.navigator.userAgent;
                  var isIOS = /iPhone|iPad|iPod/i.test(ua);
                  var isAndroid = /Android/i.test(ua);
                  var isMobile = isIOS || isAndroid;
                  var authCacheRaw = localStorage.getItem('ZISO_AUTH_CACHE_V1');
                  var profileCacheRaw = localStorage.getItem('stockwise_user_profile_v1');
                  var hasOnboardedFlag = localStorage.getItem('STOCKWISE_HAS_ONBOARDED') === 'true';
                  var authCache = null;
                  var profileCache = null;

                  try { authCache = authCacheRaw ? JSON.parse(authCacheRaw) : null; } catch (e) {}
                  try { profileCache = profileCacheRaw ? JSON.parse(profileCacheRaw) : null; } catch (e) {}

                  var canBypassDashboardSkeleton =
                    (
                      hasOnboardedFlag ||
                      !!(profileCache && profileCache.userId && profileCache.hasOnboarded !== false)
                    ) &&
                    (
                      !!(authCache && authCache.authorized === true) ||
                      !!(profileCache && profileCache.userId)
                    );

                  if (isIOS) document.body.classList.add('is-ios');
                  if (isAndroid) document.body.classList.add('is-android');
                  if (isMobile) document.body.classList.add('is-mobile');
                  if (canBypassDashboardSkeleton) {
                    document.documentElement.classList.add('dashboard-boot-ready');
                  }
                } catch(e) {}
              })();
            `,
          }}
        />
        {children}
        <Analytics />
      </body>
    </html>
  );
}
