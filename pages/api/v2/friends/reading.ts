// BFF — ดูดวงเพื่อน (ประชุม 24 พ.ย. ข้อ 2). เรียกได้เฉพาะเจ้าของรายชื่อ (session) และเฉพาะแถวเพื่อนของตัวเอง.
//
//   GET  /api/v2/friends/reading?id=<member_with_friend.id>  → ใบเสนอราคา: ไม่คำนวณ ไม่หักชี
//        { friend, hasBirthTime, canCompute, plan: { basis, priceQi, freeUsedAfter }, balance, freeSlots: { used, max } | null }
//   POST /api/v2/friends/reading { id }                       → คำนวณดวง → บันทึกสล็อต/หัก 30 ชี → ดวง
//
//   401/409 ตัวตน · 404 ไม่ใช่เพื่อนของเรา · 422 วันเกิดใช้คำนวณไม่ได้ · 402 ชีไม่พอ · 502 engine ล้ม
//   503 ตารางสล็อตยังไม่พร้อม (เฉพาะ Pro — ไม่หักชี ไม่เดาว่าไม่มีสล็อต)
//
// 🔴 ลำดับ "คำนวณก่อน แล้วค่อยหัก": ไม่มีทางเสียชีแล้วดวงไม่ออก (engine ล้ม = ไม่หัก) และไม่มีทางได้ดวง
//    โดยไม่จ่าย (ดวงถูกส่งออกหลังบันทึกสล็อต/หักชีสำเร็จเท่านั้น — 402 ไม่มีเนื้อหาติดมาด้วย)
// กติกา (Pro 10 คนแรกฟรี · นอกนั้น 30 ชีทุกครั้ง) อยู่ที่ features/v2-friends/reading-policy.ts ที่เดียว
// เนื้อหาดวงมาจาก engine ทั้งหมด (lib/v2/friend-reading-engine.ts) — ไม่มีข้อความปั้น
import type { NextApiRequest, NextApiResponse } from 'next'
import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { memberWithFriend, user } from '@/lib/db/schema'
import { baziFetch } from '@/lib/bazi/fetch'
import { mergeEngineBirth } from '@/lib/bazi-bridge/engine-birth'
import { toBaziInput, userRowToFeCalcInput, type FeCalcInput, type UserBirthRow } from '@/lib/bazi-bridge/input'
import { resolveRouteMember } from '@/lib/v2/resolve-user'
import { resolveSubscription } from '@/lib/v2/subscription'
import { computeFriendChart, postFriendEssence } from '@/lib/v2/friend-reading-engine'
import { FriendSlotStoreUnavailable, friendSlotState, takeFriendSlot } from '@/lib/v2/friend-reading-slots'
import { FRIEND_READING_CODE, FRIEND_READING_QI, PRO_FREE_FRIENDS, friendReadingPlan, type ReadingBasis, type ReadingPlan } from '@/features/v2-friends/reading-policy'

const BASE = process.env.BAZI_BASE_URL || 'http://localhost:3000'
const ID_RE = /^[A-Za-z0-9-]{1,64}$/
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/

type FriendView = { id: string; name: string; pictureUrl: string | null; fe: FeCalcInput }

const str = (v: unknown): string => (typeof v === 'string' ? v : '')

async function loadFriend(userId: string, id: string): Promise<FriendView | null> {
  const [row] = await db
    .select()
    .from(memberWithFriend)
    .where(and(eq(memberWithFriend.id, id), eq(memberWithFriend.userId, userId))) // ทั้ง id และเจ้าของ — ห้ามอ่านดวงเพื่อนของคนอื่นจาก id เดา
    .limit(1)
  if (!row) return null
  let birth: UserBirthRow = { name: row.name, dob: row.dob, time: row.time, gender: row.gender, place_name: row.placeName, is_remember_time: row.isRememberTime }
  let pictureUrl: string | null = row.pictureUrl
  // เพื่อนที่เป็นสมาชิก (member_id ชี้บัญชี user) → วันเกิดจริงอยู่ที่ตาราง user (GET /api/member-with-friend ก็อ่านทางนี้)
  // และใช้ของโปรไฟล์ engine ทับเหมือนหน้าดวงของเจ้าตัว (mergeEngineBirth) — ชะตาตรงกับที่เพื่อนเห็นของตัวเอง
  if (row.memberId !== '') {
    const [u] = await db
      .select({ name: user.name, dob: user.dob, time: user.time, gender: user.gender, placeName: user.placeName, isRememberTime: user.isRememberTime, pictureUrl: user.pictureUrl })
      .from(user)
      .where(eq(user.userId, row.memberId))
      .limit(1)
    if (u) {
      birth = await mergeEngineBirth(row.memberId, { name: u.name, dob: u.dob, time: u.time, gender: u.gender, place_name: u.placeName, is_remember_time: u.isRememberTime })
      pictureUrl = u.pictureUrl ?? pictureUrl
    }
  }
  const name = `${str(row.name)}${str(row.surname) ? ` ${str(row.surname)}` : ''}`.trim() || 'เพื่อน'
  return { id: row.id, name, pictureUrl, fe: userRowToFeCalcInput(birth) }
}

async function isProMember(userId: string): Promise<boolean> {
  try {
    const m = await resolveSubscription(userId)
    return m.isPaid === true && m.tier === 'PRO'
  } catch {
    return false // อ่านสิทธิ์ไม่ได้ → ไม่ให้ฟรี (เสียเปรียบเอง ไม่เสียรายได้)
  }
}

/** ยอดชีปัจจุบันจาก engine (null = อ่านไม่ได้ → จอไม่โชว์ตัวเลขปลอม) */
async function walletQi(memberId: string): Promise<number | null> {
  try {
    const r = await baziFetch(`${BASE}/api/qi/wallet?anonId=${encodeURIComponent(memberId)}&history=0`)
    if (!r.ok) return null
    const j = (await r.json().catch(() => null)) as { qi?: unknown } | null
    return typeof j?.qi === 'number' && Number.isFinite(j.qi) ? j.qi : null
  } catch {
    return null
  }
}

async function planFor(memberId: string, isPro: boolean, friendId: string): Promise<{ plan: ReadingPlan; used: number }> {
  if (!isPro) return { plan: friendReadingPlan({ isPro: false, slotsUsed: 0, alreadySlotted: false }), used: 0 }
  const s = await friendSlotState(memberId, friendId)
  return { plan: friendReadingPlan({ isPro: true, slotsUsed: s.used, alreadySlotted: s.already }), used: s.used }
}

const publicFriend = (f: FriendView) => ({ id: f.id, name: f.name, pictureUrl: f.pictureUrl })

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const who = await resolveRouteMember(req, res)
  if (!who.ok) {
    res.status(who.status).json(who.body)
    return
  }
  const memberId = who.userId
  const rawId = req.method === 'POST' ? (req.body as { id?: unknown } | undefined)?.id : req.query.id
  const id = typeof rawId === 'string' ? rawId.trim() : ''
  if (!ID_RE.test(id)) {
    res.status(400).json({ error: 'id is required' })
    return
  }

  if (req.method === 'GET') {
    try {
      const friend = await loadFriend(memberId, id)
      if (!friend) {
        res.status(404).json({ error: 'friend not found' })
        return
      }
      const isPro = await isProMember(memberId)
      let used = 0
      let plan: ReadingPlan
      try {
        ;({ plan, used } = await planFor(memberId, isPro, id))
      } catch (e) {
        if (e instanceof FriendSlotStoreUnavailable) {
          res.status(503).json({ error: 'friend reading slots are not ready', code: 'slots_unavailable' })
          return
        }
        throw e
      }
      res.status(200).json({
        friend: publicFriend(friend),
        hasBirthTime: toBaziInput(friend.fe).hasBirthTime,
        canCompute: ISO_DATE_RE.test(str(friend.fe.dob).trim().slice(0, 10)),
        plan,
        balance: plan.priceQi > 0 ? await walletQi(memberId) : null,
        freeSlots: isPro ? { used, max: PRO_FREE_FRIENDS } : null,
      })
    } catch {
      res.status(500).json({ error: 'friend reading quote failed' })
    }
    return
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  try {
    const friend = await loadFriend(memberId, id)
    if (!friend) {
      res.status(404).json({ error: 'friend not found' })
      return
    }
    const dob = str(friend.fe.dob).trim().slice(0, 10)
    if (!ISO_DATE_RE.test(dob)) {
      res.status(422).json({ error: 'friend birth date is not usable', code: 'birth_unusable' })
      return
    }
    const { rawInput, hasBirthTime } = toBaziInput(friend.fe)
    const isPro = await isProMember(memberId)
    let plan: ReadingPlan
    let used = 0
    try {
      ;({ plan, used } = await planFor(memberId, isPro, id))
    } catch (e) {
      if (e instanceof FriendSlotStoreUnavailable) {
        res.status(503).json({ error: 'friend reading slots are not ready', code: 'slots_unavailable' })
        return
      }
      throw e
    }

    // 1) คำนวณก่อน — ชะตาเป็นส่วนหลัก ถ้าส่วนใดล้ม = ไม่หักชี ไม่ส่งดวง
    const [chartR, essenceR] = await Promise.allSettled([computeFriendChart({ ...friend.fe, dob }, BASE), postFriendEssence(rawInput, BASE)])
    if (chartR.status === 'rejected' || essenceR.status === 'rejected') {
      res.status(502).json({ error: 'engine unavailable', code: 'engine_unavailable' })
      return
    }

    // 2) แล้วค่อยคิดเงิน
    let basis: ReadingBasis = plan.basis
    let chargedQi = 0
    let balance: number | null = null
    if (basis === 'new_slot') {
      let took: boolean
      try {
        took = await takeFriendSlot(memberId, id, PRO_FREE_FRIENDS)
      } catch (e) {
        if (e instanceof FriendSlotStoreUnavailable) {
          res.status(503).json({ error: 'friend reading slots are not ready', code: 'slots_unavailable' })
          return
        }
        throw e
      }
      if (!took) basis = 'qi' // สล็อตเต็มระหว่างทาง (ขอซ้ำพร้อมกัน) → ไปหักชีแทน ไม่แถมฟรี
    }
    if (basis === 'qi') {
      const spend = await baziFetch(`${BASE}/api/qi/spend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ anonId: memberId, code: FRIEND_READING_CODE, ref: `friend:${id}` }),
      })
      if (spend.status === 409) {
        // ส่งยอดจริงติดไปด้วย ให้ชีต "ชีไม่พอ" บอกยอดจากกระเป๋า ไม่ใช่สมมติว่ามี 0
        res.status(402).json({ error: 'insufficient_qi', code: 'insufficient_qi', priceQi: FRIEND_READING_QI, balance: await walletQi(memberId) })
        return
      }
      if (!spend.ok) {
        res.status(502).json({ error: 'qi spend failed', code: 'spend_failed' })
        return
      }
      const payload = (await spend.json().catch(() => null)) as { qi?: unknown; spentQi?: unknown } | null
      balance = typeof payload?.qi === 'number' && Number.isFinite(payload.qi) ? payload.qi : null
      chargedQi = typeof payload?.spentQi === 'number' && Number.isFinite(payload.spentQi) ? payload.spentQi : FRIEND_READING_QI
    }

    res.status(200).json({
      ok: true,
      friend: publicFriend(friend),
      birth: { date: dob, hasBirthTime },
      ...chartR.value,
      reading: essenceR.value,
      charge: { basis, qi: chargedQi },
      balance,
      freeSlots: isPro ? { used: basis === 'new_slot' ? used + 1 : used, max: PRO_FREE_FRIENDS } : null,
    })
  } catch {
    res.status(500).json({ error: 'friend reading failed' })
  }
}
