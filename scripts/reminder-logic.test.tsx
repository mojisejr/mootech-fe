// #287 — teeth on the PURE reminder logic (goo). No DB: time math, commit plan, adapter derivation,
// and the identity-ambiguity refusal. .test.tsx = vitest-only lane (invisible to ci.yml's tsx glob).
import { describe, it, expect } from 'vitest'
import { computeFireAt, isFireTimePast, windowStart, REMINDER_LEAD_MINUTES } from '@/lib/v2/reminder-time'
import { planReminderCommit } from '@/lib/v2/reminder-plan'
import { toReminderList, type ReminderDTO } from '@/features/v2-calendar/hooks/reminder-adapter'
import { resolveUserFromRows } from '@/lib/v2/resolve-user'

describe('reminder-time · UTC-not-local, anchored at START', () => {
  it('y5 23:00-00:59 on a day → fires 22:30 SAME day (not the day before), stored as UTC', () => {
    // 22:30 Asia/Bangkok = 15:30Z the same date. The instant is UTC, proving it is not a local string.
    expect(computeFireAt('2026-08-16', '23:00-00:59')?.toISOString()).toBe('2026-08-16T15:30:00.000Z')
  })

  it('y3 05:00-06:59 → 04:30 BKK = 21:30Z the PREVIOUS UTC day (local≠UTC caught here)', () => {
    expect(computeFireAt('2026-08-16', '05:00-06:59')?.toISOString()).toBe('2026-08-15T21:30:00.000Z')
  })

  it('the −30 rolls back across midnight AND month (synthetic 00:15 start on the 1st)', () => {
    // 00:15 BKK on 2026-09-01 → 17:15Z 08-31 → −30 → 16:45Z 08-31: day AND month rolled back correctly.
    expect(computeFireAt('2026-09-01', '00:15-02:00')?.toISOString()).toBe('2026-08-31T16:45:00.000Z')
  })

  it('lead is exactly 30 minutes', () => {
    const start = new Date('2026-08-16T23:00:00+07:00').getTime()
    expect(computeFireAt('2026-08-16', '23:00-00:59')!.getTime()).toBe(start - REMINDER_LEAD_MINUTES * 60_000)
  })

  it('rejects impossible calendar dates (round-trip guard), not silently rolls them', () => {
    expect(computeFireAt('2026-02-30', '05:00-06:59')).toBeNull() // Feb 30 → would roll to Mar 2
    expect(computeFireAt('2026-99-99', '05:00-06:59')).toBeNull()
    expect(computeFireAt('2026-08-16', '99:00-00:00')).toBeNull() // bad hour
    expect(computeFireAt('not-a-date', '05:00-06:59')).toBeNull()
    expect(windowStart('05:0006:59')).toBeNull() // no delimiter
  })

  it('isFireTimePast is inclusive of "now" (a fire time of exactly now is past)', () => {
    const now = new Date('2026-08-16T12:00:00Z')
    expect(isFireTimePast(new Date('2026-08-16T12:00:00Z'), now)).toBe(true)
    expect(isFireTimePast(new Date('2026-08-16T12:00:01Z'), now)).toBe(false)
  })
})

describe('reminder-plan · atomic batch + reject-in-the-past', () => {
  const yam = (id: string, window: string) => ({ yamId: id, yamLabel: `ยาม ${id}`, window })
  const now = new Date('2026-08-16T00:00:00Z') // 07:00 BKK on 08-16

  it('empty ยาม / empty destinations → 400, nothing planned', () => {
    expect(planReminderCommit({ date: '2026-08-20', yams: [], destinations: ['mumate'] }, now)).toMatchObject({ ok: false, status: 400 })
    expect(planReminderCommit({ date: '2026-08-20', yams: [yam('y3', '05:00-06:59')], destinations: [] }, now)).toMatchObject({ ok: false, status: 400 })
  })

  it('a future batch plans one row per ยาม with its own fire instant', () => {
    const plan = planReminderCommit({ date: '2026-08-20', yams: [yam('y3', '05:00-06:59'), yam('y5', '23:00-00:59')], destinations: ['mumate'] }, now)
    expect(plan.ok).toBe(true)
    if (plan.ok) {
      expect(plan.rows.map((r) => r.yamId)).toEqual(['y3', 'y5'])
      expect(plan.rows[1].fireAtUtc.toISOString()).toBe('2026-08-20T15:30:00.000Z')
    }
  })

  it('ANY past ยาม fails the WHOLE batch (atomic) → 422 + pastYamIds, zero rows', () => {
    // now = 07:00 BKK 08-16. y3 05:00 on 08-16 → fire 04:30 already past; y-late 23:00 still future.
    const plan = planReminderCommit(
      { date: '2026-08-16', yams: [yam('y3', '05:00-06:59'), yam('y5', '23:00-00:59')], destinations: ['mumate'] },
      now,
    )
    expect(plan).toMatchObject({ ok: false, status: 422, pastYamIds: ['y3'] })
  })
})

describe('reminder-adapter · group DERIVED from fireAtUtc, deduped by id', () => {
  const dto = (id: string, date: string, fireAtUtc: string): ReminderDTO => ({
    id, date, yamId: 'y1', yamLabel: 'ยาม', window: '05:00-06:59', destinations: ['mumate'], fireAtUtc,
  })
  const now = new Date('2026-08-16T12:00:00Z')

  it('fireAtUtc < now → past · >= now → upcoming (never trusts a stored group)', () => {
    const list = toReminderList([
      dto('a', '2026-08-10', '2026-08-10T00:00:00Z'), // past
      dto('b', '2026-08-20', '2026-08-20T00:00:00Z'), // upcoming
    ], now)
    expect(list.past.map((r) => r.id)).toEqual(['a'])
    expect(list.upcoming.map((r) => r.id)).toEqual(['b'])
  })

  it('a duplicate id (retry/refetch) collapses to one row — totals count once', () => {
    const list = toReminderList([
      dto('a', '2026-08-20', '2026-08-20T00:00:00Z'),
      dto('a', '2026-08-20', '2026-08-20T00:00:00Z'),
    ], now)
    expect(list.totalYams).toBe(1)
    expect(list.upcoming).toHaveLength(1)
  })

  it('totalDays counts distinct dates', () => {
    const list = toReminderList([
      dto('a', '2026-08-20', '2026-08-20T00:00:00Z'),
      dto('b', '2026-08-20', '2026-08-20T02:00:00Z'),
      dto('c', '2026-08-21', '2026-08-21T00:00:00Z'),
    ], now)
    expect(list.totalYams).toBe(3)
    expect(list.totalDays).toBe(2)
  })
})

describe('resolveUserFromRows · refuse ambiguity, never pick row[0] (ตู๋ #254 B2)', () => {
  it('one distinct user_id → ok', () => {
    expect(resolveUserFromRows([{ user_id: 'u1' }, { user_id: 'u1' }])).toEqual({ ok: true, userId: 'u1' })
  })
  it('no rows → 404', () => {
    expect(resolveUserFromRows([])).toMatchObject({ ok: false, status: 404 })
  })
  it('two DIFFERENT user_ids → 409 (refuse, not coin-flip)', () => {
    expect(resolveUserFromRows([{ user_id: 'u1' }, { user_id: 'u2' }])).toMatchObject({ ok: false, status: 409 })
  })
  it('blank/whitespace ids are dropped before deciding', () => {
    expect(resolveUserFromRows([{ user_id: '  ' }, { user_id: 'u1' }])).toEqual({ ok: true, userId: 'u1' })
  })
})

// #348 — ตัวแปลงยอมรับชั่วโมงหลักเดียว (ฟีมเคาะทาง D).
//
// รากที่บั๊กนี้รอด: เคสด้านบนทุกตัวเป็นชั่วโมง 2 หลักที่ "คนเขียนพิมพ์เอง" ⇒ ไม่เคยแตะข้อมูลจริงจากตาราง
// HOUR_RANGE ที่ 5/12 ค่าเป็นชั่วโมงหลักเดียว ⇒ เขียว 100% ทั้งที่ 42% ของยามตั้งเตือนไม่ได้เลย.
// ⚠️ ขอบเขตของด่านนี้: 12 ค่านี้ copy มาจาก bazi-sft-dataset (almanac-engine.ts:124-126 · pdf-dev · verify
//    2026-08-19). ถ้า bazi แก้ตาราง เทสต์นี้จะ "ไม่แดง" เพราะมันจำค่าไว้เอง ⇒ กันได้ครึ่งเดียว ไม่ใช่ทั้งหมด.
const HOUR_RANGE_REAL = [
  '23:00-00:59', '1:00-2:59', '3:00-4:59', '5:00-6:59',
  '7:00-8:59', '9:00-10:59', '11:00-12:59', '13:00-14:59',
  '15:00-16:59', '17:00-18:59', '19:00-20:59', '21:00-22:59',
]
const SINGLE_DIGIT = ['1:00-2:59', '3:00-4:59', '5:00-6:59', '7:00-8:59', '9:00-10:59']

describe('#348 · ชั่วโมงหลักเดียว — ยิงข้อมูลจริงจาก HOUR_RANGE ไม่ใช่สตริงที่พิมพ์เอง', () => {
  const now = new Date('2026-08-19T12:00:00Z') // ก่อนทุก fire time ของ 2026-08-20 ⇒ ตัดตัวแปร "เลยเวลา" ออกหมด
  const yam = (id: string, window: string) => ({ yamId: id, yamLabel: `ยาม ${id}`, window })

  it('ครบทั้ง 12 ค่าจากตาราง → computeFireAt ไม่เป็น null (วันพรุ่งนี้)', () => {
    for (const w of HOUR_RANGE_REAL) {
      expect(computeFireAt('2026-08-20', w), `window ${w}`).not.toBeNull()
    }
  })

  it('ชั่วโมงหลักเดียว → windowStart คืนแบบ pad 2 หลัก ❌ ไม่ใช่ null ไม่ใช่ "1:00"', () => {
    expect(windowStart('1:00-2:59')).toBe('01:00')
    expect(windowStart('3:00-4:59')).toBe('03:00')
    expect(windowStart('9:00-10:59')).toBe('09:00')
    for (const w of SINGLE_DIGIT) expect(windowStart(w), w).toMatch(/^\d{2}:\d{2}$/)
  })

  it('🔴 กับดัก pad: ยิงทะลุถึง instant จริง — เลขคำนวณถูก ไม่ใช่แค่ไม่ null', () => {
    // 9:00 BKK 08-20 = 02:00Z − 30 = 01:30Z (พิสูจน์ผ่านด่าน round-trip :59 ด้วย)
    expect(computeFireAt('2026-08-20', '9:00-10:59')?.toISOString()).toBe('2026-08-20T01:30:00.000Z')
    // 1:00 BKK 08-20 = 18:00Z 08-19 − 30 = 17:30Z 08-19 (ม้วนข้ามเที่ยงคืนกลับ + หลักเดียว)
    expect(computeFireAt('2026-08-20', '1:00-2:59')?.toISOString()).toBe('2026-08-19T17:30:00.000Z')
  })

  it('🔴 planReminderCommit: ยามเช้าหลักเดียวตัวเดียว (พรุ่งนี้) → ok rows=1 (เดิม 400)', () => {
    const plan = planReminderCommit({ date: '2026-08-20', yams: [yam('B3', '9:00-10:59')], destinations: ['mumate'] }, now)
    expect(plan.ok).toBe(true)
    if (plan.ok) expect(plan.rows).toHaveLength(1)
  })

  it('🔴 planReminderCommit: เย็น(2หลัก) + เช้า(หลักเดียว) ปนกัน → ได้ทั้งคู่ rows=2 ❌ ไม่ล้มทั้งชุด', () => {
    const plan = planReminderCommit(
      { date: '2026-08-20', yams: [yam('B_ev', '19:00-20:59'), yam('B_mo', '3:00-4:59')], destinations: ['mumate'] },
      now,
    )
    expect(plan.ok).toBe(true)
    if (plan.ok) expect(plan.rows.map((r) => r.yamId).sort()).toEqual(['B_ev', 'B_mo'])
  })

  it('NEGATIVE CONTROL · ค่าที่ควรเป็น null ยังเป็น null', () => {
    expect(windowStart('99:00-00:00')).toBeNull() // ชั่วโมงเกิน 23
    expect(windowStart('05:0006:59')).toBeNull() // ไม่มีขีดคั่น
    expect(windowStart('not-a-date')).toBeNull()
    expect(windowStart('1:99-2:00')).toBeNull() // นาทีเกิน 59 — หลักเดียวชั่วโมงก็ยังกัน
    // 🔴 ตู๋ #349 — นาทีหลักเดียว "5" กำกวม (05 หรือ 50?) ⇒ regex นาทีคง \d{2} ⇒ reject ❌ ไม่ให้ padStart
    //    เดาแทนข้อมูล (ตระกูลเดียวกับบั๊กที่ใบนี้แก้). ผ่อนแค่ชั่วโมง ไม่ผ่อนนาที.
    expect(windowStart('9:5-10:59')).toBeNull() // นาที START หลักเดียว
    expect(windowStart('9:00-10:5')).toBeNull() // นาที END หลักเดียว (sibling)
  })

  it('NEGATIVE CONTROL · ของที่เคยถูกต้องห้ามขยับ (2 หลักเหมือนเดิมเป๊ะ)', () => {
    expect(computeFireAt('2026-08-20', '19:00-20:59')?.toISOString()).toBe('2026-08-20T11:30:00.000Z')
    expect(windowStart('05:00-06:59')).toBe('05:00')
  })
})
