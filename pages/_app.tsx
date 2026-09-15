import "@/styles/globals.css";
import "@/styles/what-if.css";
import "leaflet/dist/leaflet.css";
import { SessionProvider } from "next-auth/react";
import type { AppProps } from "next/app";
import { useRouter } from "next/router";
import { CookiesProvider } from "react-cookie";
import IdentitySelfHeal from "@/components/identity-self-heal";
import AnalyticsIdentity from "@/components/analytics-identity";
import { ANALYTICS_CONSENT_COOKIE, ANALYTICS_STORAGE_DEFAULT } from "@/lib/analytics/consent";
import AppErrorBoundary from "@/components/app-error-boundary";
// side-effect: ดัก `beforeinstallprompt` ตั้งแต่แอปโหลด (event ยิงครั้งเดียวก่อน component mount) — #install
import "@/lib/pwa/use-install-prompt";
import Script from "next/script";
import Head from "next/head";
import { useEffect } from "react";

export default function App({ Component, pageProps: { session, ...pageProps } }: AppProps) {
  // v2 (Mumate redesign) ใช้ IBM Plex Sans Thai เป็นฟอนต์ root ตาม Figma — ครอบด้วย display:contents (ไม่กระทบ layout,
  // font-family สืบทอดผ่านได้) เฉพาะเส้นทาง /v2 เพื่อไม่แตะหน้า v1 ที่ยังใช้ Prompt/Sarabun
  const { pathname } = useRouter();
  const isV2 = pathname === "/v2" || pathname.startsWith("/v2/");
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

  // ขนาดตัวอักษร (settings-text-size-sheet, ก้อน 4) — apply ค่าที่บันทึกในเครื่องตั้งแต่โหลดแอป
  useEffect(() => {
    const saved = Number(window.localStorage.getItem("v2:text-scale") ?? "1");
    if (Number.isFinite(saved) && saved > 0 && saved !== 1) {
      document.documentElement.style.zoom = String(saved);
    }
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

      {/* Analytics (CIEL mootech-ga4-instrumentation-001). Three things happen BEFORE the GTM loader, in
          this order, because the Google tag reads them once at Initialization and never again:
            1. `gtag` shim — consent commands must be pushed as an Arguments object; a plain array is ignored.
            2. consent default — the app's own model is opt-out (ConsentScreen 'analytics' def: true), so
               analytics_storage starts at ANALYTICS_STORAGE_DEFAULT and drops to denied only when the
               member's stored choice (cookie mumate-ca, written by /api/v2/analytics/identity) says '0'.
            3. identity — if the keyed user_id cookie (mumate-aid) is present, push user_id + member_state so
               this very page view is attributed to the person, not the cookie. The values are read from
               document.cookie synchronously; nothing waits on a network call.
          The payment lane never sees any of this: its CSP (middleware.ts, #493) blocks the inline loader. */}
      <Script id="gtm" strategy="afterInteractive">{`
        (function(w,d,s,l,i){w[l]=w[l]||[];w.gtag=w.gtag||function(){w[l].push(arguments)};
        var c=d.cookie,m=c.match(/(?:^|;\\s*)${ANALYTICS_CONSENT_COOKIE}=([01])/);
        w.gtag('consent','default',{analytics_storage:(m?m[1]==='1':${ANALYTICS_STORAGE_DEFAULT === "granted"})?'granted':'denied'});
        var a=c.match(/(?:^|;\\s*)mumate-aid=([0-9a-f]{32})/);if(a){w[l].push({user_id:a[1],member_state:'member'});}
        w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
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
          {/* Analytics identity: watches the member id land and sends login + user_id once per login. */}
          <AnalyticsIdentity />
          {/* #399 — a single render throw used to blank the whole app. The boundary keeps the
              rest of the page recoverable (reload / home) and still logs the trace. */}
          <AppErrorBoundary>
            <div className={isV2 ? "contents font-ibm" : "contents"}>
              <Component {...pageProps} />
            </div>
          </AppErrorBoundary>
        </SessionProvider>
      </CookiesProvider>
    </>
  );
}
