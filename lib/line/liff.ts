// LIFF SDK wrapper — on demand only (slice 7c, 2026-10-02).
//
// LIFF ไม่ใช้กับการล็อกอินแล้ว (#860/#863: ช่อง LIFF อยู่คนละ LINE Provider → LINE userId ไม่ตรง → บัญชีซ้ำ) และไม่ boot
// ทุกหน้าแล้ว (LiffBoot ถอดออก). เหลือใช้เฉพาะตอนผู้ใช้กด ในบริบท LIFF browser (entry ผ่าน https://liff.line.me/<id>
// เช่น rich menu) ซึ่งทำได้ผ่าน SDK เท่านั้น:
//   - liff.openWindow({ external: true }) พาออกเบราว์เซอร์จริง (lib/browser/open-external.ts)
//   - shareTargetPicker แชร์ลิงก์เชิญเข้าแชต LINE (lib/v2/share-invite.ts)
// เมื่อทีมเปลี่ยน rich menu เป็น URL ปกติแล้ว ไฟล์นี้และ @line/liff ถอดได้ทั้งหมด.
//
// LIFF ID = ค่าสาธารณะ (อยู่ใน LIFF URL) ฝัง default ได้ ไม่ต้องพึ่ง Vercel env (override ด้วย env ได้).
export const LIFF_ID = process.env.NEXT_PUBLIC_LIFF_ID || "2011679472-sNcCbR2K";

// dedupe init: ผู้เรียกหลายจุดอาจเรียกพร้อมกัน — init รอบเดียว.
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
