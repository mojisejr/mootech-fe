import "@/styles/globals.css";
import "@/styles/what-if.css";
import { SessionProvider } from "next-auth/react";
import type { AppProps } from "next/app";
import { CookiesProvider } from "react-cookie";
import IdentitySelfHeal from "@/components/identity-self-heal";
import Script from "next/script";
import Head from "next/head";
import { useEffect } from "react";

export default function App({ Component, pageProps: { session, ...pageProps } }: AppProps) {
  const gtm = "GTM-MLZC4FRC";

  // PWA (#285): register the Serwist-built service worker. Only in production — the SW is `disable`d
  // in dev (next.config.mjs), so /sw.js doesn't exist there and registering would 404. sw.ts uses
  // skipWaiting + clientsClaim so a new deploy takes over on the next load (ตู๋'s gate: one refresh,
  // never "close the tab first").
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch((err) => {
      console.error("[pwa] service worker registration failed", err);
    });
  }, []);
  return (
    <>
      {/* viewport-fit=cover is required for env(safe-area-inset-*) to resolve on notched
          devices — the full-screen mobile chat depends on it (#mootech-chat-mobile-ux). */}
      <Head>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, viewport-fit=cover"
        />
      </Head>

      <Script id="gtm" strategy="afterInteractive">{`
        (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
        new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
        j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
        'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
        })(window,document,'script','dataLayer','${gtm}');
      `}</Script>

      <CookiesProvider>
        <SessionProvider session={session}>
          {/* Global identity self-heal (#mumate-line-webview-oauth, Fix B):
              recovers a missing MEMBER_ID on deep-link entry so auth-gated pages
              don't hang on ScreenLoading. Renders null; runs before the page. */}
          <IdentitySelfHeal />
          <Component {...pageProps} />
        </SessionProvider>
      </CookiesProvider>
    </>
  );
}
