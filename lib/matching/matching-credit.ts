// lib/matching/matching-credit.ts — matching_slot credit ต่อ paid-gate ดวงสมพงศ์ (เจ้าของ 2026-09-15).
//
// โมเดล: โควตา tier รายเดือน (FREE 2 / PLUS 20 / PRO ∞) = "ฟรี". เมื่อโควตานั้นหมด แต่ผู้ใช้มี
// matching_slot credit (จากคูปองแมทช์สมพงศ์ หรือ /ops grant) → ยอมให้คำนวณ แล้วหัก credit 1 หลังสำเร็จ.
// อ่าน balance จาก engine entitlements (แหล่งเดียวกับที่ /ops/คูปอง grant); หักผ่าน /api/qi/matching-consume.
// ทั้งคู่ best-effort — ล้ม/เอนจินดับ ไม่ทำให้ผู้ใช้พัง (อ่านล้ม = 0 = fail-closed; หักล้ม = ปล่อย ผู้ใช้ได้ผลไปแล้ว).
const BASE = process.env.BAZI_BASE_URL || 'http://localhost:3000'

/** matching_slot credit คงเหลือของผู้ใช้ (0 เมื่ออ่านไม่ได้ — fail-closed ไม่แจกเกิน). */
export async function getMatchingCredits(anonId: string): Promise<number> {
  try {
    const r = await fetch(`${BASE}/api/qi/entitlements?anonId=${encodeURIComponent(anonId)}`)
    if (!r.ok) return 0
    const j = (await r.json().catch(() => null)) as { credits?: { matching_slot?: unknown } } | null
    const n = Number(j?.credits?.matching_slot ?? 0)
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0
  } catch {
    return 0
  }
}

/** หัก matching_slot credit 1 (best-effort — หลังคำนวณสำเร็จและดึงจาก credit). */
export async function consumeMatchingCredit(anonId: string): Promise<void> {
  try {
    await fetch(`${BASE}/api/qi/matching-consume`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ anonId }),
    })
  } catch {
    /* ปล่อย — ผู้ใช้ได้ผลไปแล้ว, over-grant อย่างมาก 1 (เหมือน card) */
  }
}
