import "@/styles/globals.css";
import { SessionProvider } from "next-auth/react";
import type { AppProps } from "next/app";
import { CookiesProvider } from "react-cookie";
import Script from "next/script";

export default function App({ Component, pageProps: { session, ...pageProps } }: AppProps) {
  const gtm = "GTM-MLZC4FRC";
  return (
    <>
      <Script id="gtm" strategy="afterInteractive">{`
        (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
        new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
        j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
        'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
        })(window,document,'script','dataLayer','${gtm}');
      `}</Script>

      <CookiesProvider>
        <SessionProvider session={session}>
          <Component {...pageProps} />
        </SessionProvider>
      </CookiesProvider>
    </>
  );
}
