import { useEffect, useRef } from "react";

// LIFF boot (#mumate-line-liff, ฟิว/tester + เอ็ม 2026-09-20).
//
// ROOT CAUSE ที่ไล่จนเจอ: LINE Labs → "เปิดลิงก์ด้วยเบราว์เซอร์เริ่มต้น" = ON → กดลิงก์จาก LINE เด้งไป
// Safari/Chrome ภายนอก → OAuth ต้อง app-switch (Safari→แอป LINE→กลับ) → cookie jar หาย → login พัง.
// login "ทำงานได้เสมอ" ถ้าเปิดใน in-app browser ของ LINE. เราสั่งผู้ใช้ปิด setting ไม่ได้ →
// ทางแก้ที่ครอบทุกคน = เปลี่ยน entry (rich menu) เป็น "LIFF URL" (https://liff.line.me/{liffId})
// ซึ่ง LINE เปิดใน in-app browser เสมอ ไม่สน setting → OAuth เดิมที่ทำงานใน in-app browser ก็ใช้ได้กับทุกคน.
//
// คอมโพเนนต์นี้แค่ liff.init() ให้ endpoint เป็น LIFF app ที่ถูกต้อง (เปิดทาง native login ในอนาคต) —
// ยังไม่บังคับ login / ไม่ redirect (ระดับถัดไปค่อยใช้ liff.getIDToken() ทำ login แบบไม่มี OAuth redirect).
// import แบบ dynamic = SDK ถูก bundle (ไม่โหลด external script) → ไม่ชน CSP ของ payment lane.
// no-op ถ้ายังไม่ตั้ง NEXT_PUBLIC_LIFF_ID (ก่อนเอ็มสร้าง LIFF app + ใส่ env) — ปลอดภัย ไม่กระทบหน้าเว็บปกติ.
// LIFF app "mumatelogin" (ฟิวสร้าง 2026-09-20) — endpoint = https://bazichart.mumate.co, size Full,
// region Thailand (อันแรก 2011679438-DiPwB1A5 region เป็น Japan เลยสร้างใหม่). LIFF ID เป็นค่า "สาธารณะ"
// (อยู่ใน LIFF URL ที่แชร์ในแชท) จึงฝัง default ในโค้ดได้ ไม่ต้องพึ่ง Vercel env (override ด้วย
// NEXT_PUBLIC_LIFF_ID ได้). rich menu ต้องชี้ไป https://liff.line.me/2011679472-sNcCbR2K เพื่อให้
// LINE เปิดใน in-app browser เสมอ.
const DEFAULT_LIFF_ID = "2011679472-sNcCbR2K";

export default function LiffBoot(): null {
  const done = useRef(false);
  useEffect(() => {
    const liffId = process.env.NEXT_PUBLIC_LIFF_ID || DEFAULT_LIFF_ID;
    if (!liffId || done.current) return;
    done.current = true;
    void (async () => {
      try {
        const liff = (await import("@line/liff")).default;
        await liff.init({ liffId });
      } catch {
        // ไม่ใช่บริบท LIFF หรือ init ไม่สำเร็จ — ปล่อยหน้าให้ทำงานเป็นเว็บปกติ (OAuth เดิมยังใช้ได้ใน in-app browser)
      }
    })();
  }, []);
  return null;
}
