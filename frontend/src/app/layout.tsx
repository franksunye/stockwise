import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/react";
import { headers } from "next/headers";
import { brandCoreZhCN } from "@/content/brand-core.zh-CN";
import { getHtmlLang, isSupportedPublicLocale } from "@/lib/public-i18n";
import { ServiceWorkerRegistrar } from "@/components/ServiceWorkerRegistrar";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || brandCoreZhCN.domain),
  manifest: "/manifest.json",
  icons: {
    icon: "/logo.png",
    apple: "/logo.png",
  },
  openGraph: {
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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const requestHeaders = await headers();
  const localeHeader = requestHeaders.get("x-ziso-locale");
  const locale = isSupportedPublicLocale(localeHeader) ? localeHeader : "zh";

  return (
    <html lang={getHtmlLang(locale)}>
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
        <ServiceWorkerRegistrar />
        <Analytics />
      </body>
    </html>
  );
}
