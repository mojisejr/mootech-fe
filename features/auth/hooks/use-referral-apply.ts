// features/auth/hooks/use-referral-apply.ts — ยิงโค้ดแนะนำตอนสมัคร (team.mp4: หน้าสมัครเพิ่มช่อง
// "โค้ดผู้แนะนำ"; ผู้ชวน +250 coins · คนกรอก +100 coins คนละครั้งตลอดชีพ).
//
// เรียก **หลัง**บันทึกโปรไฟล์สำเร็จเท่านั้น (cookie-mumate-id ต้องพร้อม ไม่งั้น BFF ตอบ 401) และ
// ❌ ห้ามให้ referral ล้มแล้วพังการสมัคร — สมัครสำเร็จคือสมัครสำเร็จ; โค้ดผิด/หมดสิทธิ์ผู้ใช้ไปที่
// /v2/qi พิมพ์ใหม่ได้ (จอพลังชี่มีช่องเดียวกัน)
import { useCallback } from 'react'

/** เดียวกับ CODE_RE ของ BFF (pages/api/referral.ts) — กันยิงของที่จะไม่ผ่านอยู่แล้วตั้งแต่หน้าจอ */
export const REFERRAL_CODE_RE = /^[A-Za-z0-9]{4,32}$/

export function useReferralApply() {
  return useCallback(async (code: string): Promise<boolean> => {
    const clean = code.trim()
    if (!REFERRAL_CODE_RE.test(clean)) return false
    try {
      const r = await fetch('/api/referral', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: clean }),
      })
      return r.ok
    } catch {
      return false // เน็ตล่ม — การสมัครยังสำเร็จอยู่; โค้ดใส่ใหม่ได้ที่ /v2/qi
    }
  }, [])
}
