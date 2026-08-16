// MuMate PWA · phase-1 diagnostic page (goo · #285). NOT in the ใบ's "แตะอะไรบ้าง" list — added so ฟีม
// has a real path to VERIFY the phase-1 DoD (install → full screen → permission → subscription) before
// มุน builds the real controls in phase 2 (#286). Disclosed in the issue + PR.
//
// It reads capability and, on a button press, requests a REAL push subscription. Because that is a real
// side-effect (not "nothing secret"), the page is GATED behind the v2 preview cookie (getServerSideProps
// below, ตู๋ F3) — it must not be publicly reachable on prod. No v2-calendar files touched.
import { useState } from "react";
import type { GetServerSideProps } from "next";
import Head from "next/head";
import { usePwaCapability } from "@/lib/pwa/capability";
import { requestPushSubscription, type SubscribeResult } from "@/lib/pwa/subscribe";
import { v2RedirectIfUnauthed } from "@/lib/v2/gate";

const SAPPHIRE = "#1455A4";
const BG = "#ECF0FD";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid #dfe6f5" }}>
      <span style={{ color: "#464646" }}>{label}</span>
      <span style={{ fontWeight: 600, color: "#0B305B" }}>{value}</span>
    </div>
  );
}

/** null/unknown → "ยังไม่รู้" so the screen never lies before detection resolves. */
const triState = (v: boolean | null): string => (v === null ? "ยังไม่รู้…" : v ? "ใช่" : "ไม่");

export default function PwaCheckPage() {
  const capability = usePwaCapability();
  const [result, setResult] = useState<SubscribeResult | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubscribe = async () => {
    setBusy(true);
    const r = await requestPushSubscription();
    setResult(r);
    // ดูใน console ได้ — DoD bullet 2
    console.log("[pwa-check] requestPushSubscription →", r);
    if (r.ok) console.log("[pwa-check] endpoint:", r.subscription.endpoint);
    setBusy(false);
  };

  return (
    <>
      <Head>
        <title>PWA check · MuMate</title>
      </Head>
      <main style={{ minHeight: "100dvh", background: BG, padding: 20, fontFamily: "system-ui, sans-serif", maxWidth: 480, margin: "0 auto" }}>
        <h1 style={{ color: "#0B305B", fontSize: 20 }}>ตรวจความพร้อม PWA</h1>
        <p style={{ color: "#71717A", fontSize: 13, marginTop: 4 }}>
          หน้าตรวจของ phase 1 (#285) — ยังไม่ใช่หน้าจริง จอจริงมาใน phase 2 ของมุน
        </p>

        <section style={{ background: "#fff", borderRadius: 12, padding: "4px 16px", marginTop: 16 }}>
          <Row label="รับ push ได้ไหม" value={triState(capability.canReceivePush)} />
          <Row label="ต้องติดตั้งก่อนไหม" value={triState(capability.needsInstall)} />
          <Row label="สิทธิ์แจ้งเตือน" value={capability.permission} />
        </section>

        {capability.needsInstall === true && (
          <p style={{ background: "#FFF4E6", color: "#8a4b00", borderRadius: 12, padding: 14, marginTop: 16, fontSize: 14 }}>
            ยังติดตั้งไม่ได้จากแท็บนี้ — กดปุ่ม “แชร์” ของ Safari แล้วเลือก “เพิ่มลงหน้าจอโฮม”
            จากนั้นเปิดแอปจากไอคอน แล้วค่อยขอสิทธิ์แจ้งเตือน
          </p>
        )}

        {capability.canReceivePush === false && capability.needsInstall === false && (
          <p style={{ background: "#FDECEC", color: "#8a1f1f", borderRadius: 12, padding: 14, marginTop: 16, fontSize: 14 }}>
            เบราว์เซอร์นี้ยังไม่รองรับการแจ้งเตือนแบบ push
          </p>
        )}

        <button
          onClick={onSubscribe}
          disabled={busy || capability.canReceivePush !== true}
          style={{
            width: "100%", marginTop: 20, padding: "14px 0", borderRadius: 12, border: "none",
            background: capability.canReceivePush === true ? SAPPHIRE : "#c3cbe0",
            color: "#E1FF00", fontWeight: 700, fontSize: 16,
            cursor: capability.canReceivePush === true ? "pointer" : "not-allowed",
          }}
        >
          {busy ? "กำลังขอสิทธิ์…" : "ขออนุญาตแจ้งเตือน"}
        </button>

        {result && (
          <pre style={{ background: "#0B305B", color: "#E1FF00", borderRadius: 12, padding: 14, marginTop: 16, fontSize: 12, overflowX: "auto", whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
            {result.ok
              ? `✅ subscription ได้แล้ว\nendpoint:\n${result.subscription.endpoint}`
              : `❌ ${result.reason}`}
          </pre>
        )}
      </main>
    </>
  );
}

// ตู๋ F3: this diagnostic page creates a REAL subscription, so it is not public — same v2 preview gate
// as every other /v2 page (ฟีม reaches it through the gate). Self-destructs at launch: once
// V2_PREVIEW_KEY is removed, isV2Authenticated → false → this always redirects to /v2 before render.
export const getServerSideProps: GetServerSideProps = async ({ req }) => {
  return v2RedirectIfUnauthed(req) ?? { props: {} };
};
