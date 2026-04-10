import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/react";
import Image from "next/image";
import { brandCoreZhCN } from "@/content/brand-core.zh-CN";
import { ServiceWorkerRegistrar } from "@/components/ServiceWorkerRegistrar";
import { buildRootBootstrapInlineScript } from "@/lib/root-bootstrap";
import Script from "next/script";

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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const rootBootstrapInlineScript = buildRootBootstrapInlineScript();

  return (
    <html lang="en" suppressHydrationWarning>
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
                  if (pathname === '/cn' || pathname.indexOf('/cn/') === 0) {
                    document.documentElement.lang = 'zh-CN';
                  } else if (pathname === '/ko' || pathname.indexOf('/ko/') === 0) {
                    document.documentElement.lang = 'ko';
                  } else if (pathname === '/es' || pathname.indexOf('/es/') === 0) {
                    document.documentElement.lang = 'es';
                  } else {
                    document.documentElement.lang = 'en';
                  }
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
          suppressHydrationWarning
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
          <Image
            src="/logo.png"
            alt="ZISO AI"
            width={88}
            height={88}
            priority
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
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-QXYCXRCL4P"
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());

            if (window.location.hostname === 'ziso.cc' || window.location.hostname === 'www.ziso.cc') {
              gtag('config', 'G-QXYCXRCL4P');
            }
          `}
        </Script>
        <Script id="microsoft-clarity" strategy="afterInteractive">
          {`
            if (window.location.hostname === 'ziso.cc' || window.location.hostname === 'www.ziso.cc') {
              (function(c,l,a,r,i,t,y){
                  c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
                  t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i+"?ref=bwt";
                  y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
              })(window, document, "clarity", "script", "w8b3c6w7hs");
            }
          `}
        </Script>
      </body>
    </html>
  );
}
