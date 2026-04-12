import { Analytics } from "@vercel/analytics/react";
import Image from "next/image";
import Script from "next/script";
import { ServiceWorkerRegistrar } from "@/components/ServiceWorkerRegistrar";
import { buildRootBootstrapInlineScript } from "@/lib/root-bootstrap";

type AppDocumentShellProps = {
  children: React.ReactNode;
  htmlLang: string;
};

export function AppDocumentShell({ children, htmlLang }: AppDocumentShellProps) {
  const rootBootstrapInlineScript = buildRootBootstrapInlineScript();

  return (
    <html lang={htmlLang} suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <link rel="preconnect" href="https://app.ziso.cc" />
        <link rel="dns-prefetch" href="https://app.ziso.cc" />
        <link rel="preconnect" href="https://va.vercel-scripts.com" />
      </head>
      <body className="antialiased" suppressHydrationWarning>
        <div
          id="app-splash"
          suppressHydrationWarning
          style={{
            position: "fixed",
            inset: "0",
            background: "#050508",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 2147483647,
            opacity: 1,
            transition: "opacity 220ms ease-out",
          }}
        >
          <Image
            src="/logo.png"
            alt="ZISO AI"
            width={88}
            height={88}
            priority
            style={{ borderRadius: "18px", opacity: 0.9 }}
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

            var hostname = window.location.hostname || '';
            var isTrackedHost =
              hostname === 'ziso.cc' ||
              hostname.endsWith('.ziso.cc');

            if (isTrackedHost) {
              gtag('config', 'G-QXYCXRCL4P');
            }
          `}
        </Script>
        <Script id="microsoft-clarity" strategy="afterInteractive">
          {`
            var hostname = window.location.hostname || '';
            var isTrackedHost =
              hostname === 'ziso.cc' ||
              hostname.endsWith('.ziso.cc');

            if (isTrackedHost) {
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
