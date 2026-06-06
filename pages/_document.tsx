import { Html, Head, Main, NextScript } from "next/document";

export default function Document() {
  const gtm = "GTM-MLZC4FRC";
  return (
    <Html lang="en">
      <Head>
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
