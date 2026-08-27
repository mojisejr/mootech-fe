// #455 slice 1 — ฟันฝั่งฐานข้อมูล: วันหมดอายุลงแถวจริง และเดินทางออกไปถึงตัวอ่านที่จอใช้
//
// 🔴 ทำไมต้องมีชั้นนี้ ไม่ใช่แค่ unit: ใบนี้แตะ schema · กติกาบ้านบังคับ e2e เมื่อ schema เปลี่ยนหรือมี
// write path ใหม่ · และเทสต์ที่ mock repo จะพิสูจน์แค่ "ถ้าเรียกถูก แล้วจะถูก" ❌ ไม่ได้พิสูจน์ว่าคอลัมน์
// มีอยู่จริง เขียนลงได้จริง และอ่านกลับออกมาได้จริง (บทเรียนของ #466)
//
// Run:  TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5433/mumate_test \
//       DATABASE_URL=postgres://postgres:postgres@localhost:5433/mumate_test \
//       npx vitest run scripts/qr-expiry-row-db.test.ts
//
// 🔴 MUTANT CONTRACT (แต่ละตัวมีข้อความ failure ของตัวเอง)
//   QD1  attachChargeId ทิ้ง expiresAt (set แค่ chargeId)        → ① reddens
//   QD2  ไม่ส่ง argument แล้วเขียนทับเป็น null                    → ② reddens
//        ⚠️ ตู๋ #476: เคสนี้ยังไม่มีใครเดินในโปรดักชัน — charge-flow.ts:155 ส่งอาร์กิวเมนต์ที่ 3 เสมอทั้ง
//        สองเลน (บัตรส่ง null · พร้อมเพย์ส่งค่าจริง) ⇒ ฟันตัวนี้เฝ้า**รูปร่างที่ยังไม่มีคนใช้**
//        เก็บไว้เพราะมันจะกัดวันที่มีผู้เขียนคนที่สอง ❌ แต่ห้ามอ่านว่ามันปิดความเสี่ยงของวันนี้
//   QD3  ค่าที่ parse ไม่ได้ถูกเขียนลงไปแทนที่จะเป็น null         → ③ reddens
//   QD4  listUserPayments เลิก select คอลัมน์นี้                  → ④ reddens  ← จอจะไม่มีวันรู้
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import postgres from 'postgres'
import { attachChargeId, listUserPayments } from '@/lib/payment/repo'

const TEST_URL = process.env.TEST_DATABASE_URL
const M0011 = readFileSync(resolve('lib/db/0011_v2_payment_qr_expiry.sql'), 'utf8')
const EXPIRES = '2026-08-27T10:05:00.000Z'

describe.skipIf(!TEST_URL)('#455 charge_expires_at ลงแถวจริงและอ่านกลับได้', () => {
  let sql: ReturnType<typeof postgres>
  let userId: string
  const ids: string[] = []

  beforeAll(async () => {
    sql = postgres(TEST_URL as string, { max: 4, ssl: false })
    await sql.unsafe(M0011) // idempotent — ADD COLUMN IF NOT EXISTS
    const rows = await sql`SELECT user_id FROM "user" LIMIT 1`
    userId = rows[0]?.user_id as string
    expect(userId, 'the test database must have at least one user').toBeTruthy()
  })

  afterAll(async () => {
    if (sql) {
      await sql`DELETE FROM v2_payment WHERE id = ANY(${ids})`
      await sql.end()
    }
  })
  afterEach(async () => {
    await sql`DELETE FROM v2_payment WHERE id = ANY(${ids})`
    ids.length = 0
  })

  /** แถว PENDING ที่ยังไม่มี charge จริง — เหมือนที่ insertPendingReserved สร้าง */
  const seed = async (id: string) => {
    ids.push(id)
    await sql`INSERT INTO v2_payment
      (id, user_id, package_code, tier_code, amount_satang, vat_satang, expire, buffer_day, method, charge_id, order_id, status)
      VALUES (${id}, ${userId}, 'V2_PLUS_YEARLY', 'PLUS', 79000, 0, '1Y', 0, 'promptpay', ${'placeholder_' + id}, ${'ord_' + id}, 'PENDING')`
    return id
  }
  const readCol = async (id: string) =>
    (await sql`SELECT charge_expires_at FROM v2_payment WHERE id = ${id}`)[0]?.charge_expires_at ?? null

  it('🔴 ① the gateway deadline lands in the row (QD1)', async () => {
    const id = await seed('qd-1')
    await attachChargeId(id, 'chrg_real_1', EXPIRES)
    const stored = await readCol(id)
    expect(stored).not.toBeNull()
    expect(new Date(stored as Date).toISOString()).toBe(EXPIRES)
  })

  it('🔴 ② omitting the argument leaves an existing deadline alone (QD2)', async () => {
    const id = await seed('qd-2')
    await attachChargeId(id, 'chrg_real_2', EXPIRES)
    // เรียกซ้ำแบบไม่ส่งค่า — เช่นเส้นทางบัตร หรือการอัปเดต charge id รอบสอง
    await attachChargeId(id, 'chrg_real_2b')
    const stored = await readCol(id)
    expect(new Date(stored as Date).toISOString(), 'ไม่ส่งค่า = ไม่แตะคอลัมน์ ❌ ไม่ใช่ล้างทิ้ง').toBe(EXPIRES)
  })

  it('🔴 ③ an unparsable deadline is stored as null, never as garbage (QD3)', async () => {
    const id = await seed('qd-3')
    await attachChargeId(id, 'chrg_real_3', 'ไม่ใช่วันที่')
    expect(await readCol(id)).toBeNull()
  })

  it('🔴 ④ listUserPayments carries it out to the screen (QD4)', async () => {
    const id = await seed('qd-4')
    await attachChargeId(id, 'chrg_real_4', EXPIRES)
    const rows = await listUserPayments(userId)
    const mine = rows.find((r) => r.chargeId === 'chrg_real_4')
    expect(mine, 'แถวที่เพิ่งเขียนต้องอยู่ในผลลัพธ์').toBeTruthy()
    expect(new Date(mine!.chargeExpiresAt as Date).toISOString()).toBe(EXPIRES)
  })

  it('CONTROL — แถวที่ไม่เคยมีวันหมดอายุ อ่านออกมาเป็น null ไม่ระเบิด (charge เก่า 124 ตัวคือกรณีนี้)', async () => {
    const id = await seed('qd-5')
    await attachChargeId(id, 'chrg_real_5') // ไม่ส่งค่าเลย เหมือนเลนบัตร
    expect(await readCol(id)).toBeNull()
    const rows = await listUserPayments(userId)
    expect(rows.find((r) => r.chargeId === 'chrg_real_5')?.chargeExpiresAt ?? null).toBeNull()
  })
})
