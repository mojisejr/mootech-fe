// lib/qi/grant.ts — ตัวเรียก engine (bazi-pdf-dev) เครดิตชี่จากการซื้อ (buy-qi) + trigger โบนัสผู้ชวน.
//
// ปลายทาง: POST {BAZI_BASE_URL}/api/qi/grant { secret, anonId, kind, qi?, reason?, ref? }
//   · idempotent ด้วย ref = charge_id (engine เช็ค ledger ก่อนบวก — ยิงซ้ำได้ ไม่บวกซ้ำ)
//   · kind 'qi'    → บวกชี่ + โบนัสซื้อครั้งแรก +30 (ครั้งเดียวตลอดชีพ ฝั่ง engine กันซ้ำเอง)
//   · kind 'plus'/'pro' → ไม่มีชี่; engine ยิงโบนัสผู้ชวน referral_plus/referral_pro ให้ผู้ชวนเอง
// secret = QI_GRANT_SECRET (env — ต้องประกาศใน .env.example, engine ฝั่งต้นทางต้องตั้งค่าเดียวกัน;
// fail-closed: engine ไม่ตั้ง secret = endpoint ปฏิเสธหมด)
//
// เรียกจาก settleAndProvision (lib/payment/repo.ts) หลัง transaction จบเท่านั้น — ห้ามถือ DB transaction
// ข้าม network call
import { qiBonusOf, qiQtyOf } from '@/lib/payment/catalog'

export type QiPurchaseRef = { userId: string; packageCode: string; chargeId: string }

const ENGINE_BASE = process.env.BAZI_BASE_URL || 'http://localhost:3000'

export async function grantQiPurchase(ref: QiPurchaseRef): Promise<boolean> {
  const secret = process.env.QI_GRANT_SECRET
  if (!secret) {
    // fail loud แต่ไม่ throw — เงินจัดการที่ caller (settle) แล้ว; ไม่มี secret = ระบบยังไม่พร้อมขายชี่
    console.error('[qi] QI_GRANT_SECRET ไม่ได้ตั้ง — ยิง grant ไม่ได้ (ต้องตั้งทั้ง FE และ engine ให้ตรงกัน)')
    return false
  }
  const qty = qiQtyOf(ref.packageCode)
  if (qty === null) {
    console.error(`[qi] unknown QI package_code ${ref.packageCode} — ยิง grant ไม่ได้ (ควรโดน catalog ตัดตั้งแต่ quote)`)
    return false
  }
  // ปริมาณ QI ที่เครดิตจริง = จำนวนแพ็ก + โบนัสรายแพ็ก (Figma +20/+75/+250) — โบนัสซื้อครั้งแรก +30
  // engine บวกให้เองแยกต่างหาก (once ต่อบัญชี)
  const qi = qty + qiBonusOf(ref.packageCode)
  const upstream = await fetch(`${ENGINE_BASE}/api/qi/grant`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      secret,
      anonId: ref.userId,
      kind: 'qi',
      qi,
      reason: ref.packageCode,
      ref: ref.chargeId,
    }),
  })
  if (!upstream.ok) {
    const body = await upstream.json().catch(() => ({}))
    throw new Error(`engine /api/qi/grant ${upstream.status}: ${JSON.stringify(body)}`)
  }
  return true
}

/** trigger โบนัสผู้ชวนหลังผู้ถูกชวนอัปเกรด PLUS/PRO สำเร็จ (เรียกหลัง provision ของเลนสมาชิก) */
export async function fireReferralUpgradeTrigger(userId: string, tier: 'PLUS' | 'PRO'): Promise<void> {
  const secret = process.env.QI_GRANT_SECRET
  if (!secret) return // ระบบชี่ไม่ได้ตั้ง — ข้ามอย่างเงียบ (โบนัสผู้ชวนเป็นของแถม ไม่ใช่ส่วนของการซื้อสมาชิก)
  await fetch(`${ENGINE_BASE}/api/qi/grant`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ secret, anonId: userId, kind: tier.toLowerCase(), ref: `tier:${tier}` }),
  }).catch((error: unknown) => {
    console.error('[qi] referral upgrade trigger failed:', userId, tier, error instanceof Error ? error.message : error)
  })
}
