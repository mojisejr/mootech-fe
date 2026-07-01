import "@/styles/globals.css";
import { SessionProvider } from "next-auth/react";
import type { AppProps } from "next/app";
import { CookiesProvider } from "react-cookie";
import IdentitySelfHeal from "@/components/identity-self-heal";
import Script from "next/script";
import Head from "next/head";

export default function App({ Component, pageProps: { session, ...pageProps } }: AppProps) {
  const gtm = "GTM-MLZC4FRC";
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
