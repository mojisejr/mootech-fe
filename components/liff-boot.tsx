import { useEffect, useRef } from "react";
import { getLiff } from "@/lib/line/liff";

// LIFF boot (#mumate-line-liff, ฟิว/tester + เอ็ม 2026-09-20).
//
// ROOT CAUSE ที่ไล่จนเจอ: LINE Labs → "เปิดลิงก์ด้วยเบราว์เซอร์เริ่มต้น" = ON → กดลิงก์จาก LINE เด้งไป
// Safari/Chrome ภายนอก → OAuth ต้อง app-switch (Safari→แอป LINE→กลับ) → cookie jar หาย → login พัง.
// login "ทำงานได้เสมอ" ถ้าเปิดใน in-app browser ของ LINE. เราสั่งผู้ใช้ปิด setting ไม่ได้ →
// ทางแก้ที่ครอบทุกคน = เปลี่ยน entry (rich menu) เป็น "LIFF URL" (https://liff.line.me/{liffId})
// ซึ่ง LINE เปิดใน in-app browser เสมอ ไม่สน setting → OAuth เดิมที่ทำงานใน in-app browser ก็ใช้ได้กับทุกคน.
//
// คอมโพเนนต์นี้แค่ init LIFF (ผ่าน getLiff ที่ dedupe init ให้ทั้งแอป) — ยังไม่บังคับ login / ไม่ redirect.
// การเปิด external browser (ติดตั้ง PWA/notification) อยู่ใน lib/line/liff.ts (openInExternalBrowser).
// no-op โดยธรรมชาติถ้าไม่ใช่บริบท LIFF (init จะ throw แล้วถูกกลืน) — ปลอดภัย ไม่กระทบหน้าเว็บปกติ.
export default function LiffBoot(): null {
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    done.current = true;
    void getLiff();
  }, []);
  return null;
}
