import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/react";
import { brandCoreZhCN } from "@/content/brand-core.zh-CN";
import { ServiceWorkerRegistrar } from "@/components/ServiceWorkerRegistrar";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || brandCoreZhCN.domain),
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <link rel="preconnect" href="https://app.ziso.cc" />
        <link rel="dns-prefetch" href="https://app.ziso.cc" />
        <link rel="preconnect" href="https://va.vercel-scripts.com" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var ua = window.navigator.userAgent || '';
                  var isIOS = /iPhone|iPad|iPod/i.test(ua);
                  if (!isIOS) return;

                  // iOS PWA cold-start: add a non-blocking splash overlay (dark + logo)
                  // to avoid the white flash/repaint during cold boot.
                  function mountSplash() {
                    try {
                      if (document.getElementById('ios-pwa-splash')) return;
                      var splash = document.createElement('div');
                      splash.id = 'ios-pwa-splash';
                      var img = document.createElement('img');
                      img.src = '/logo.png';
                      img.alt = 'ZISO AI';
                      splash.appendChild(img);
                      document.body.appendChild(splash);
                    } catch (e) {}
                  }

                  function hideSplash() {
                    try {
                      var splash = document.getElementById('ios-pwa-splash');
                      if (!splash) return;
                      splash.classList.add('is-hiding');
                      setTimeout(function() {
                        try { splash.remove(); } catch (e) {}
                      }, 260);
                    } catch (e) {}
                  }

                  // Mount as soon as body exists.
                  if (document.readyState === 'loading') {
                    document.addEventListener('DOMContentLoaded', mountSplash, { once: true });
                  } else {
                    mountSplash();
                  }

                  // Hide on full load. Also add a short fallback hide to reduce perceived delay.
                  window.addEventListener('load', hideSplash, { once: true });
                  setTimeout(hideSplash, 1200);
                } catch (e) {}
              })();
            `,
          }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var pathname = window.location.pathname || '/';
                  var isEnglishPublicPath = pathname === '/en' || pathname === '/en/' || pathname.indexOf('/en/') === 0;
                  document.documentElement.lang = isEnglishPublicPath ? 'en' : 'zh-CN';
                } catch (e) {}
              })();
            `,
          }}
        />
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
