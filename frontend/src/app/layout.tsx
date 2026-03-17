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
        {/* Splash moved to server-rendered #app-splash in <body> for reliability */}
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
        {/* Server-rendered splash: in the HTML from the first byte, no script timing dependency.
            Visible by default; the inline script below removes it for desktop / non-dashboard. */}
        <div
          id="app-splash"
          style={{
            position: 'fixed',
            inset: '0',
            background: '#050508',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2147483647,
            opacity: 1,
            transition: 'opacity 220ms ease-out',
          }}
        >
          <img
            src="/logo.png"
            alt="ZISO AI"
            width={88}
            height={88}
            style={{ borderRadius: '18px', opacity: 0.9 }}
          />
        </div>
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

                  // Splash visibility: only keep for mobile users on app subdomain dashboard.
                  // All other routes (landing page, pricing, terms, etc.) and desktop
                  // get it removed before first paint (this script runs synchronously).
                  var splash = document.getElementById('app-splash');
                  if (splash) {
                    var host = window.location.hostname;
                    var path = window.location.pathname;
                    var isAppHost = host === 'app.ziso.cc' || host.indexOf('app.') === 0;
                    var isDashboardRoute = path === '/dashboard' || path.indexOf('/dashboard/') === 0;
                    var isLocalDev = host === 'localhost' || host === '127.0.0.1';

                    // Suppress splash for in-app navigations (any sub-page → dashboard).
                    // Uses localStorage with a 2-minute TTL instead of sessionStorage
                    // because iOS standalone WKWebView can silently clear sessionStorage
                    // during background/resume cycles, causing the splash to reappear.
                    var isInSession = false;
                    try {
                      var splashTs = parseInt(localStorage.getItem('stockwise_splash_ts') || '0', 10);
                      isInSession = (Date.now() - splashTs < 120000);
                    } catch(ex) {}

                    var shouldShowSplash = !isInSession && isMobile && (isDashboardRoute || (isAppHost && path === '/') || (isLocalDev && isDashboardRoute));

                    if (!shouldShowSplash) {
                      splash.style.opacity = '0';
                      splash.style.pointerEvents = 'none';
                    } else {
                      // Safety timeout: visually hide if React fails to dismiss it.
                      // CRITICAL: Do NOT call s.remove() here — the splash is a
                      // server-rendered React node. Removing it before hydration
                      // causes a fatal React hydration mismatch on slow cold starts
                      // (especially iOS PWA after SW cache version bumps).
                      // React will handle the actual DOM removal after hydration.
                      setTimeout(function() {
                        var s = document.getElementById('app-splash');
                        if (s) { s.style.opacity = '0'; s.style.pointerEvents = 'none'; }
                      }, 4000);
                    }
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
