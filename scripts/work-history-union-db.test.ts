// #585 — ฟันฝั่งฐานข้อมูลของกติกาที่ตู๋จับได้ก่อนใครจะเขียนโค้ด
//
// 🔴 คำถามที่ไฟล์นี้ตอบ: **เทียบเพื่อนร่วมงานสองรอบ ที่บังเอิญมีตัวแทน (slot 0) เป็นคนเดียวกัน จะยังเห็นครบสองใบไหม**
// เลนคู่ dedupe ด้วย DISTINCT ON (friend_id, matching_type) — ถ้ากิ่งใหม่ลอกกติกานั้นมา ใบเก่าจะหายไปเงียบ ๆ
// ทั้งที่ผู้ใช้จ่ายโควตาไปแล้ว และหน้าจอจะดูปกติทุกประการ เพราะการ์ดที่เหลือ render ถูกต้อง
//
// ⚠️ ทำไมต้องเป็นชั้นฐานข้อมูลจริง ไม่ใช่ unit: กติกาที่กำลังตรวจ **อยู่ในตัว SQL** ไม่ได้อยู่ใน TypeScript
// ⇒ mock ใด ๆ จะพิสูจน์แค่ว่า "ถ้า SQL ถูก ผลก็ถูก" · และไฟล์นี้เรียก `listRecentHistory` ตัวจริงที่ route
// ใช้ ❌ ไม่ได้พิมพ์ SQL ซ้ำ ไม่งั้นมันจะเขียวต่อไปตอน route เปลี่ยน
//
// Run:  TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5433/mumate_test \
//       DATABASE_URL=postgres://postgres:postgres@localhost:5433/mumate_test \
//       npx vitest run scripts/work-history-union-db.test.ts
//
// 🔴 MUTANT CONTRACT
//   W1  กิ่ง work ใส่ DISTINCT ON (um.friend_id, um.matching_type)  → ① แดง  ← ตัวที่ใบนี้มีไว้เฝ้า
//   W2  ถอดกิ่ง work ออกจาก UNION                                  → ① ② แดง
//   W3  กิ่ง work คืน lane เป็น 'pair'                              → ② แดง
//   W4  ถอด WHERE wc.user_id                                       → ③ แดง
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import postgres from 'postgres'
import { listRecentHistory } from '@/lib/matching/recent-history'

const TEST_URL = process.env.TEST_DATABASE_URL
const M0014 = readFileSync(resolve('lib/db/0014_work_comparison.sql'), 'utf8')

describe.skipIf(!TEST_URL)('#585 ประวัติสองเลน — กิ่งเพื่อนร่วมงานต้องไม่รับกติกา dedupe ของเลนคู่', () => {
  let sql: ReturnType<typeof postgres>
  let userId: string
  let otherUserId: string
  let friendId: string
  const matchingIds: string[] = []

  beforeAll(async () => {
    sql = postgres(TEST_URL as string, { max: 4, ssl: false })
    await sql.unsafe(M0014) // idempotent — CREATE TABLE IF NOT EXISTS

    // ⚠️ เลือก user จาก member_with_friend ❌ ไม่ใช่จาก "user" เรียงตาม id — ผู้ใช้ส่วนใหญ่ในดัมป์ไม่มีเพื่อนเลย
    // (2,125 แถวกระจายอยู่กับผู้ใช้จำนวนน้อย) ⇒ การหยิบสองคนแรกได้คนที่ไม่มีเพื่อน แล้ว setup ล้มโดยที่
    // กติกาที่ตั้งใจตรวจยังไม่เคยถูกแตะเลย
    const owners = await sql`
      SELECT f.user_id, MIN(f.id::text) AS friend_id
        FROM member_with_friend f
        JOIN "user" u ON u.user_id = f.user_id
       GROUP BY f.user_id
       ORDER BY f.user_id
       LIMIT 2`
    userId = owners[0]?.user_id as string
    friendId = String(owners[0]?.friend_id ?? '')
    otherUserId = owners[1]?.user_id as string
    expect(userId, 'ฐานทดสอบต้องมีผู้ใช้ที่มีเพื่อนอย่างน้อย 2 คน').toBeTruthy()
    expect(friendId, 'ผู้ใช้คนแรกต้องมีเพื่อนอย่างน้อย 1 คน').toBeTruthy()
    expect(otherUserId, 'ต้องมีผู้ใช้คนที่สองไว้เป็น negative control ของสิทธิ์').toBeTruthy()

    // สองรอบ ตัวแทน slot 0 เป็นคนเดียวกัน และ matching_type เดียวกัน — คือรูปที่ DISTINCT ON จะยุบ
    for (const [i, id] of ['585-test-aaa', '585-test-bbb'].entries()) {
      matchingIds.push(id)
      await sql`INSERT INTO user_matching (id, user_id, friend_id, matching_type, create_at)
                VALUES (${id}, ${userId}, ${friendId}, 'WORK_COMPARE', ${`2026-09-01 10:0${i}:00`})`
      await sql`INSERT INTO work_comparison (matching_id, user_id, result, create_at)
                VALUES (${id}, ${userId}, ${'{"ranking":[0],"candidates":[]}'}, ${`2026-09-01 10:0${i}:00`})`
      await sql`INSERT INTO work_comparison_candidate (matching_id, slot, friend_id, rank_score)
                VALUES (${id}, 0, ${friendId}, 50)`
    }
  })

  afterAll(async () => {
    if (!sql) return
    await sql`DELETE FROM work_comparison_candidate WHERE matching_id = ANY(${matchingIds})`
    await sql`DELETE FROM work_comparison WHERE matching_id = ANY(${matchingIds})`
    await sql`DELETE FROM user_matching WHERE id = ANY(${matchingIds})`
    await sql.end()
  })

  it('① สองรอบที่ตัวแทนคนเดียวกัน ต้องเห็นครบสองใบ ❌ ไม่ยุบเหลือใบเดียว', async () => {
    const rows = await listRecentHistory(userId)
    const mine = rows.filter((r) => matchingIds.includes(r.id))
    expect(
      mine.map((r) => r.id).sort(),
      'ใบใดใบหนึ่งหายไป = กิ่ง work รับกติกา DISTINCT ON ของเลนคู่มาแล้ว',
    ).toEqual([...matchingIds].sort())
  })

  it('② ทุกใบของเลนนี้ต้องติดป้าย lane=work ไม่งั้นการ์ดจะพาไป route ที่ 404', async () => {
    const rows = await listRecentHistory(userId)
    const mine = rows.filter((r) => matchingIds.includes(r.id))
    expect(mine).toHaveLength(2)
    expect(mine.every((r) => r.lane === 'work')).toBe(true)
  })

  it('③ ประวัติของคนอื่นต้องไม่มีใบของเรา — id เดาไม่ถูกไม่ใช่กติกาสิทธิ์', async () => {
    const rows = await listRecentHistory(otherUserId)
    expect(rows.filter((r) => matchingIds.includes(r.id))).toHaveLength(0)
  })

  it('④ เรียงจากใหม่ไปเก่า และเลนคู่เดิมยังอยู่ในลิสต์เดียวกันได้', async () => {
    const rows = await listRecentHistory(userId)
    const stamps = rows.map((r) => String(r.create_at ?? ''))
    expect([...stamps].sort().reverse()).toEqual(stamps)
  })
})
