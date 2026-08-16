import { Html, Head, Main, NextScript } from "next/document";

export default function Document() {
  const gtm = "GTM-MLZC4FRC";
  return (
    <Html lang="en">
      <Head>
          {/* PWA (#285): manifest + theme + iOS home-screen meta. apple-* tags are what let iOS run
              the app full-screen (no Safari chrome) after Add-to-Home-Screen. */}
          <link rel="manifest" href="/manifest.json" />
          <meta name="theme-color" content="#1455A4" />
          <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
          <meta name="apple-mobile-web-app-capable" content="yes" />
          <meta name="apple-mobile-web-app-status-bar-style" content="default" />
          <meta name="apple-mobile-web-app-title" content="MuMate" />
          <script src="https://cdn.omise.co/omise.js"></script>
      </Head>
      <body className="antialiased">
        <noscript>
          <iframe
            src={`https://www.googletagmanager.com/ns.html?id=${gtm}`}
            height="0"
            width="0"
            style={{ display: "none", visibility: "hidden" }}
          />
        </noscript>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
