// /ops user lookup + FE-side composite (identity + tier + subscription history). QI/profile ฝั่ง engine
// ประกอบเพิ่มใน api route ผ่าน lib/ops/engine. อ่านอย่างเดียว.
import { and, desc, eq, ilike, or } from 'drizzle-orm'
import { db as defaultDb } from '@/lib/db'
import { user, memberSubscription } from '@/lib/db/schema'
import { resolveSubscription } from '@/lib/v2/subscription'

type Db = typeof defaultDb
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type OpsUserRow = { userId: string; name: string | null; email: string | null; dob: string | null; gender: string | null; pictureUrl: string | null }

/** ค้นหา user: q เป็น UUID → exact user_id; ไม่งั้น ILIKE ชื่อ/อีเมล. จำกัด 20 แถว */
export async function searchUsers(q: string, db: Db = defaultDb): Promise<OpsUserRow[]> {
  const term = q.trim()
  if (!term) return []
  const where = UUID_RE.test(term)
    ? eq(user.userId, term)
    : or(ilike(user.name, `%${term}%`), ilike(user.email, `%${term}%`), ilike(user.surname, `%${term}%`))
  const rows = await db
    .select({ userId: user.userId, name: user.name, email: user.email, dob: user.dob, gender: user.gender, pictureUrl: user.pictureUrl })
    .from(user)
    .where(where)
    .limit(20)
  return rows
}

export type OpsSubRow = { id: string; tierCode: string; packageCode: string; startAt: string; expireAt: string; status: string; amountSatang: number }

/** ข้อมูลฝั่ง FE ของ user คนหนึ่ง: identity + tier ปัจจุบัน (resolveSubscription) + ประวัติ subscription */
export async function getUserFeData(userId: string, db: Db = defaultDb) {
  const [row] = await db
    .select({
      userId: user.userId, name: user.name, surname: user.surname, email: user.email,
      dob: user.dob, time: user.time, isRememberTime: user.isRememberTime, gender: user.gender,
      placeName: user.placeName, pictureUrl: user.pictureUrl, resultCode: user.resultCode,
    })
    .from(user)
    .where(eq(user.userId, userId))
    .limit(1)
  if (!row) return null

  const membership = await resolveSubscription(userId)
  const subs: OpsSubRow[] = await db
    .select({
      id: memberSubscription.id, tierCode: memberSubscription.tierCode, packageCode: memberSubscription.packageCode,
      startAt: memberSubscription.startAt, expireAt: memberSubscription.expireAt, status: memberSubscription.status,
      amountSatang: memberSubscription.amountSatang,
    })
    .from(memberSubscription)
    .where(eq(memberSubscription.userId, userId))
    .orderBy(desc(memberSubscription.createdAt))

  return { user: row, membership, subscriptions: subs }
}
