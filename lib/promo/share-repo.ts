// lib/promo/share-repo.ts — Promo B "แชร์ให้เพื่อน Pro ฟรี 1 เดือน" (ฟิว/ซินแส 2026-09-28).
//
// กติกา: เฉพาะคนที่ "ใช้โค้ด MUMATE100 + จ่ายสำเร็จ" ถึงจะออกโค้ดแชร์ได้ · เพื่อนที่กรอก → Pro ฟรี 30 วัน
// (เขียน member_subscription 1 แถว ACTIVE PRO — FE อ่านตรงนี้เป็น tier, engine ก็ fallback มาอ่าน) ·
// เพดาน 10 คน/แอคผู้ออกโค้ด + 1000 สิทธิ์รวม. คีย์ทุกอย่างใช้ user_id (ผู้ใช้ล็อกอิน) — DB เดียวกันทั้งหมด.
import { randomInt, randomUUID } from 'node:crypto'
import { sql } from 'drizzle-orm'
import { db } from '@/lib/db'

/** โค้ดส่วนลดที่ต้องเคยใช้ + จ่ายสำเร็จ ถึงจะมีสิทธิ์ออกโค้ดแชร์ */
export const ELIGIBLE_DISCOUNT_CODE = 'MUMATE100'
export const CAMPAIGN_ID = 'MUMATE_FREE_MONTH'
export const MAX_PER_ISSUER = 10
const GRANT_TIER = 'PRO'
const GRANT_DAYS = 30
const GRANT_PACKAGE = 'PROMO_FREE_MONTH'

export type RedeemReason =
  | 'OK'
  | 'INVALID' //        โค้ดไม่มีจริง
  | 'SELF' //           กรอกโค้ดตัวเอง
  | 'ALREADY' //        เพื่อนคนนี้เคยแลกแล้ว (1 ครั้ง/คน)
  | 'ISSUER_FULL' //    ผู้ออกโค้ดครบ 10 คนแล้ว
  | 'CAMPAIGN_FULL' //  ครบ 1000 สิทธิ์รวมแล้ว

// throw เพื่อ rollback transaction (drizzle rollback เมื่อ callback throw) — ปฏิเสธหลังเริ่มนับ counter แล้ว
class Refuse extends Error {
  constructor(public reason: Exclude<RedeemReason, 'OK'>) { super(reason) }
}

// postgres-js/drizzle: db.execute(sql`...`) คืน rows แบบ array-like
async function rows(q: ReturnType<typeof sql>): Promise<Record<string, unknown>[]> {
  return (await db.execute(q)) as unknown as Record<string, unknown>[]
}

/** "ผู้ใช้คนนี้เคยใช้ MUMATE100 แล้วจ่ายสำเร็จไหม" — JOIN v2_payment เพื่อกัน PENDING (ยังไม่จ่าย) */
export async function isEligibleIssuer(userId: string): Promise<boolean> {
  const r = await rows(sql`
    SELECT 1
    FROM discount_redemption dr
    JOIN discount_code dc ON dc.id = dr.code_id
    JOIN v2_payment    p  ON p.id  = dr.payment_id
    WHERE dr.user_id = ${userId}
      AND lower(dc.code) = ${ELIGIBLE_DISCOUNT_CODE.toLowerCase()}
      AND p.status = 'APPROVED'
    LIMIT 1`)
  return r.length > 0
}

// "MMF" + 5 ตัวอักษร/เลข (ตัดตัวกำกวม 0/O/1/I) — พื้นที่พอสำหรับ 1000+ ผู้ออกโค้ด, กันชนกับ referral (MUMATE###)
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
function randomShareCode(): string {
  let s = 'MMF'
  for (let i = 0; i < 5; i++) s += ALPHABET[randomInt(0, ALPHABET.length)]
  return s
}

/** ออก/คืนโค้ดแชร์ของผู้ใช้ (เรียกหลังเช็ค isEligibleIssuer แล้วเท่านั้น) */
export async function getOrCreateShareCode(userId: string): Promise<{ code: string; used: number; max: number }> {
  const existing = await rows(sql`SELECT code, used_count FROM promo_share_code WHERE user_id = ${userId} LIMIT 1`)
  if (existing.length) {
    return { code: String(existing[0].code), used: Number(existing[0].used_count), max: MAX_PER_ISSUER }
  }
  // ยังไม่มี → มินต์ใหม่ (retry เมื่อชนโค้ดซ้ำ / แข่งกันสร้างของ user เดียวกัน)
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = randomShareCode()
    try {
      const inserted = await rows(sql`
        INSERT INTO promo_share_code (user_id, code) VALUES (${userId}, ${code})
        ON CONFLICT (user_id) DO NOTHING
        RETURNING code, used_count`)
      if (inserted.length) return { code: String(inserted[0].code), used: 0, max: MAX_PER_ISSUER }
      // user_id ชน(มีคนสร้างให้แล้วใน race) → อ่านซ้ำ
      const reread = await rows(sql`SELECT code, used_count FROM promo_share_code WHERE user_id = ${userId} LIMIT 1`)
      if (reread.length) return { code: String(reread[0].code), used: Number(reread[0].used_count), max: MAX_PER_ISSUER }
    } catch (e) {
      // ชนโค้ดซ้ำ (unique lower(code) = 23505) → ลองโค้ดใหม่; error อื่นโยนต่อ
      if ((e as { code?: string }).code !== '23505') throw e
    }
  }
  throw new Error('promo: could not mint a unique share code after 10 attempts')
}

/**
 * เพื่อนกรอกโค้ด → ได้ Pro ฟรี 30 วัน (atomic: เช็ค+นับเพดาน+grant ในทรานแซกชันเดียว).
 * ลำดับ: ปฏิเสธที่อ่านอย่างเดียวก่อน (INVALID/SELF/ALREADY) → นับ campaign(1000) → นับ issuer(10) → บันทึก → grant.
 */
export async function redeemShareCode(refereeUserId: string, codeInput: string): Promise<{ ok: boolean; reason: RedeemReason }> {
  const code = codeInput.trim()
  if (!code) return { ok: false, reason: 'INVALID' }
  try {
    await db.transaction(async (tx) => {
      const exec = async (q: ReturnType<typeof sql>) => (await tx.execute(q)) as unknown as Record<string, unknown>[]

      const codeRow = await exec(sql`SELECT user_id FROM promo_share_code WHERE lower(code) = ${code.toLowerCase()} FOR UPDATE`)
      if (!codeRow.length) throw new Refuse('INVALID')
      const issuerUserId = String(codeRow[0].user_id)
      if (issuerUserId === refereeUserId) throw new Refuse('SELF')

      const seen = await exec(sql`SELECT 1 FROM promo_share_redemption WHERE referee_user_id = ${refereeUserId} LIMIT 1`)
      if (seen.length) throw new Refuse('ALREADY')

      // เพดานรวม 1000 (atomic) — ถ้าไม่มีแถวคืน = เต็ม
      const camp = await exec(sql`
        UPDATE promo_share_campaign SET used_count = used_count + 1
        WHERE id = ${CAMPAIGN_ID} AND used_count < max_total RETURNING used_count`)
      if (!camp.length) throw new Refuse('CAMPAIGN_FULL')

      // เพดาน 10 คน/ผู้ออกโค้ด (atomic)
      const iss = await exec(sql`
        UPDATE promo_share_code SET used_count = used_count + 1
        WHERE user_id = ${issuerUserId} AND used_count < ${MAX_PER_ISSUER} RETURNING used_count`)
      if (!iss.length) throw new Refuse('ISSUER_FULL')

      // บันทึกการแลก (unique referee กัน race — ถ้าชนโยน ALREADY)
      try {
        await exec(sql`
          INSERT INTO promo_share_redemption (id, code, issuer_user_id, referee_user_id)
          VALUES (${randomUUID()}, ${code}, ${issuerUserId}, ${refereeUserId})`)
      } catch (e) {
        if ((e as { code?: string }).code === '23505') throw new Refuse('ALREADY')
        throw e
      }

      // grant: Pro ฟรี 30 วัน — เขียน member_subscription ACTIVE (FE อ่านตรงนี้เป็น tier)
      await exec(sql`
        INSERT INTO member_subscription (id, user_id, tier_code, package_code, amount_satang, start_at, expire_at, status, created_at)
        VALUES (${randomUUID()}, ${refereeUserId}, ${GRANT_TIER}, ${GRANT_PACKAGE}, 0,
          (now() AT TIME ZONE 'Asia/Bangkok')::date,
          ((now() AT TIME ZONE 'Asia/Bangkok')::date + ${`${GRANT_DAYS} days`}::interval)::date,
          'ACTIVE', now())`)
    })
    return { ok: true, reason: 'OK' }
  } catch (e) {
    if (e instanceof Refuse) return { ok: false, reason: e.reason }
    throw e
  }
}
