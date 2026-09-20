// Shared LIFF helpers (#mumate-line-liff, 2026-09-20).
//
// สองหน้าที่:
//   1) init LIFF ครั้งเดียว (dedupe ด้วย module-level promise) — LiffBoot เรียกตอน mount.
//   2) openInExternalBrowser() — เด้งออก "เบราว์เซอร์ภายนอก" (Chrome/Safari) จากใน LINE in-app browser
//      ผ่าน liff.openWindow({external:true}). จำเป็นเพราะ in-app browser ของ LINE ทำ PWA install
//      (Add to Home Screen) + web push ไม่ได้ (ข้อจำกัด WebView) → ต้องออกไปข้างนอก (เอ็ม 2026-09-20).
//
// LIFF ID = ค่าสาธารณะ (อยู่ใน LIFF URL) ฝัง default ได้ ไม่ต้องพึ่ง Vercel env (override ด้วย env ได้).
export const LIFF_ID = process.env.NEXT_PUBLIC_LIFF_ID || "2011679472-sNcCbR2K";

// dedupe init: LiffBoot (mount) และ openInExternalBrowser (click) อาจเรียกพร้อมกัน — init รอบเดียว.
let liffPromise: Promise<typeof import("@line/liff").default> | null = null;
export function getLiff(): Promise<typeof import("@line/liff").default> {
  if (!liffPromise) {
    liffPromise = (async () => {
      const liff = (await import("@line/liff")).default;
      try {
        await liff.init({ liffId: LIFF_ID });
      } catch {
        // init ซ้ำ/ล้มเหลว (ไม่ใช่บริบท LIFF) — คืน liff เดิม ให้ตัวเรียกเช็ค isInClient เอง
      }
      return liff;
    })();
  }
  return liffPromise;
}

// อยู่ใน in-app browser ของ LINE ไหม — เช็คจาก User-Agent (sync, ไม่ต้องรอ init).
// LINE webview UA มี "Line/<version>" เช่น "... Line/13.5.0".
export function isLineInAppBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  return /\bLine\//i.test(navigator.userAgent);
}

// เปิด url ในเบราว์เซอร์ "ภายนอก" (Chrome/Safari). ใน LINE → liff.openWindow({external:true});
// นอก LINE → window.open ปกติ. ใช้ตอนจะติดตั้ง PWA / เปิด notification ที่ in-app browser ทำไม่ได้.
export async function openInExternalBrowser(url: string): Promise<void> {
  try {
    const liff = await getLiff();
    if (liff.isInClient()) {
      liff.openWindow({ url, external: true });
      return;
    }
  } catch {
    // liff ใช้ไม่ได้ — ตกไป window.open
  }
  if (typeof window !== "undefined") {
    window.open(url, "_blank", "noopener");
  }
}
