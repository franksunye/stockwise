import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/react";
import { brandCoreZhCN } from "@/content/brand-core.zh-CN";
import { ServiceWorkerRegistrar } from "@/components/ServiceWorkerRegistrar";
import { buildRootBootstrapInlineScript } from "@/lib/dashboard-bootstrap";
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
  const rootBootstrapInlineScript = buildRootBootstrapInlineScript();

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
            __html: rootBootstrapInlineScript,
          }}
        />
        {children}
        <ServiceWorkerRegistrar />
        <Analytics />
      </body>
    </html>
  );
}
