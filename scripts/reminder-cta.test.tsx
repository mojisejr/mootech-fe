// #341 — ฟันของ "ยามนี้เพิ่มแล้ว/เลยเวลา/ยังเพิ่มได้ + ปุ่มแถบล่าง 7 สถานะ" (goo · logic-only).
//
// ตรรกะล้วน — pure specs ยิงได้โดยไม่ต้องมีเบราว์เซอร์ (นั่นคือเหตุผลที่ใบนี้แยกจาก UI ของมุน). มีเทสต์ฮุค
// 2 ตัว (renderHook) เฉพาะจุดที่ TS ยันไม่ได้: open() ติ๊กยามล่วงหน้า + useReminders เปิดเผย addedYamIdsFor จริง.
// .test.tsx = เลน vitest เท่านั้น (ci.yml tsx lane ข้ามด้วยชื่อ) — ต้องลงทะเบียนใน vitest.config.mts include[].
import React from 'react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import {
  yamReminderStatus,
  dayReminderCta,
  DAY_CTA_SAVING_LABEL,
  DAY_CTA_JUST_SAVED_LABEL,
  DAY_CTA_ADD_MORE_LABEL,
  DAY_CTA_VIEW_LIST_LABEL,
  DAY_CTA_EXPIRED_LABEL,
  DAY_CTA_OPEN_LABEL,
  DAY_CTA_LOCKED_LABEL,
} from '@/features/v2-calendar/tier-lock'
import { isYamPast } from '@/lib/v2/reminder-time'
import { addedYamIdsForDate, useReminders } from '@/features/v2-calendar/hooks/useReminders'
import { useReminderDraft } from '@/features/v2-calendar/hooks/useReminderDraft'
import type { YamSlot } from '@/features/v2-calendar/types'
import type { ReminderDTO } from '@/features/v2-calendar/hooks/reminder-adapter'

const DATE = '2026-08-20'
// now = 2026-08-20 13:00 BKK. fire = 30 นาทีก่อน start ยาม:
//   05:00 start → fire 04:30 BKK = 2026-08-19T21:30Z  ≤ now  → PAST
//   13:00 start → fire 12:30 BKK = 2026-08-20T05:30Z  ≤ now  → PAST
//   19:00 start → fire 18:30 BKK = 2026-08-20T11:30Z  > now  → FUTURE (addable)
//   23:00 start → fire 22:30 BKK = 2026-08-20T15:30Z  > now  → FUTURE (addable)
const NOW = new Date('2026-08-20T06:00:00Z')
const y = (id: string, window: string): YamSlot => ({ id, label: `ยาม ${id}`, window })
const PAST_A = y('y3', '05:00-06:59')
const PAST_B = y('y4', '13:00-14:59')
const FUTURE_A = y('y2', '19:00-20:59')
const FUTURE_B = y('y5', '23:00-00:59')

// ─── reminder-time.isYamPast — the composer ─────────────────────────────────
describe('#341 · isYamPast — ประกอบ computeFireAt + isFireTimePast', () => {
  it('ยามที่ fire ไปแล้ว → true', () => {
    expect(isYamPast(DATE, PAST_A.window, NOW)).toBe(true)
  })
  it('ยามที่ยังไม่ถึง fire → false', () => {
    expect(isYamPast(DATE, FUTURE_A.window, NOW)).toBe(false)
  })
  it('window พัง (computeFireAt=null) → false ❌ ไม่โกหกว่าเลยเวลา', () => {
    expect(isYamPast(DATE, 'not-a-window', NOW)).toBe(false)
    expect(isYamPast(DATE, '99:99-10:00', NOW)).toBe(false)
  })
})

// ─── yamReminderStatus — 3 สถานะ + tie-break ────────────────────────────────
describe('#341 · yamReminderStatus — เพิ่มแล้ว/เลยเวลา/เพิ่มได้', () => {
  const status = (yam: YamSlot, added: string[]) =>
    yamReminderStatus({ yam, date: DATE, addedYamIds: added, now: NOW })

  it('ยังไม่เพิ่ม + ยังไม่ถึงเวลา → addable', () => {
    expect(status(FUTURE_A, [])).toBe('addable')
  })
  it('ยังไม่เพิ่ม + เลยเวลา → past', () => {
    expect(status(PAST_A, [])).toBe('past')
  })
  it('เพิ่มแล้ว (ยังไม่ถึงเวลา) → added', () => {
    expect(status(FUTURE_A, ['y2'])).toBe('added')
  })
  it('🔑 tie-break: เพิ่มแล้ว + เลยเวลา พร้อมกัน → added ชนะ (ฟีมเคาะ)', () => {
    // PAST_A เลยเวลาแน่ (isYamPast=true) แต่ถูกเพิ่มไว้ → ต้องได้ added ไม่ใช่ past
    expect(isYamPast(DATE, PAST_A.window, NOW)).toBe(true)
    expect(status(PAST_A, ['y3'])).toBe('added')
  })
})

// ─── #586 · ยามคร่อมเที่ยงคืน — 子 "23:00-00:59" (ตัวเดียวในตารางที่ข้ามวัน) ─────────────
// ฟีมรายงานว่า "ผ่านไปแล้วยังกดได้ ยามเดียวในตาราง" — ตรวจของจริงด้วย repro (2026-09-03):
// ตรรกะ anchor ที่ start (computeFireAt → D 22:30 สำหรับยามนี้) ครอบข้ามเที่ยงคืนถูกต้องอยู่แล้ว
// สิ่งที่ใบนี้แก้จริงคือ `now` บนหน้าที่ค้างจาก render เดียว (useNowMinute) ส่วนที่นี่คือฟันพิสูจน์ว่า
// ตรรกะจับเคสข้ามเที่ยงคืนได้จริงทุกช่วง ด้วยเวลาที่ฉีดเข้าไป ❌ ไม่ใช่นาฬิกาจริง (ตามข้อบังคับของใบ)
describe('#586 · ยามคร่อมเที่ยงคืน — 23:00-00:59', () => {
  const MIDNIGHT = y('y5', '23:00-00:59')
  const statusAt = (iso: string) =>
    yamReminderStatus({ yam: MIDNIGHT, date: DATE, addedYamIds: [], now: new Date(iso) })

  it('ยังไม่ถึง (20:00 ของวันเดิม) → addable', () => {
    // 20:00 BKK = 13:00Z
    expect(isYamPast(DATE, MIDNIGHT.window, new Date('2026-08-20T13:00:00Z'))).toBe(false)
    expect(statusAt('2026-08-20T13:00:00Z')).toBe('addable')
  })
  it('เริ่มแล้วครึ่งแรก (23:30 ของวันเดิม) → past', () => {
    // 23:30 BKK = 16:30Z — fire (22:30 BKK) ผ่านไปแล้ว
    expect(isYamPast(DATE, MIDNIGHT.window, new Date('2026-08-20T16:30:00Z'))).toBe(true)
    expect(statusAt('2026-08-20T16:30:00Z')).toBe('past')
  })
  it('🔴 ครึ่งหลังผ่านไปแล้วเต็มตัว (01:30 ของวันถัดไป) → past — เคสที่รายงานใน issue', () => {
    // 01:30 วันถัดไป BKK = 18:30Z — ท้ายยาม (00:59) เลยมาแล้ว
    expect(isYamPast(DATE, MIDNIGHT.window, new Date('2026-08-20T18:30:00Z'))).toBe(true)
    expect(statusAt('2026-08-20T18:30:00Z')).toBe('past')
  })
})

// ─── dayReminderCta — 7 สถานะ + precedence ──────────────────────────────────
describe('#341 · dayReminderCta — ปุ่มแถบล่าง 7 สถานะ', () => {
  const base = {
    isPaid: true as boolean | null,
    saving: false,
    justSaved: false,
    yams: [] as YamSlot[],
    addedYamIds: [] as string[],
    date: DATE,
    now: NOW,
  }
  const spies = () => ({ openSheet: vi.fn(), goToShop: vi.fn(), goToList: vi.fn() })
  const cta = (o: Partial<typeof base>, s = spies()) => ({
    p: dayReminderCta({ ...base, ...o, ...s }),
    ...s,
  })

  it('1 · ยังไม่มีอะไร · ยังเพิ่มได้ → open · กดเปิดชีท', () => {
    const { p, openSheet } = cta({ yams: [FUTURE_A, FUTURE_B], addedYamIds: [] })
    expect(p.kind).toBe('open')
    expect(p.label).toBe(DAY_CTA_OPEN_LABEL)
    expect(p.disabled).toBe(false)
    p.press()
    expect(openSheet).toHaveBeenCalledTimes(1)
  })

  it('2 · กำลังบันทึก → saving · กดไม่ได้', () => {
    const { p, openSheet, goToList } = cta({ saving: true, yams: [FUTURE_A] })
    expect(p.kind).toBe('saving')
    expect(p.label).toBe(DAY_CTA_SAVING_LABEL)
    expect(p.disabled).toBe(true)
    p.press()
    expect(openSheet).not.toHaveBeenCalled()
    expect(goToList).not.toHaveBeenCalled()
  })

  it('3 · เพิ่งบันทึกเสร็จ → justSaved · กดไม่ได้', () => {
    const { p, openSheet } = cta({ justSaved: true, yams: [FUTURE_A] })
    expect(p.kind).toBe('justSaved')
    expect(p.label).toBe(DAY_CTA_JUST_SAVED_LABEL)
    expect(p.disabled).toBe(true)
    p.press()
    expect(openSheet).not.toHaveBeenCalled()
  })

  it('4 · มีแล้ว · ยังเพิ่มได้อีก → addMore · กดเปิดชีท', () => {
    const { p, openSheet } = cta({ yams: [FUTURE_A, FUTURE_B], addedYamIds: ['y2'] })
    expect(p.kind).toBe('addMore')
    expect(p.label).toBe(DAY_CTA_ADD_MORE_LABEL)
    p.press()
    expect(openSheet).toHaveBeenCalledTimes(1)
  })

  it('5 · มีแล้ว · เพิ่มไม่ได้อีก → viewList · กดไปหน้ารายการ', () => {
    // y2 เพิ่มแล้ว, ที่เหลือ (y3) เลยเวลา → ไม่มี addable
    const { p, openSheet, goToList } = cta({ yams: [FUTURE_A, PAST_A], addedYamIds: ['y2'] })
    expect(p.kind).toBe('viewList')
    expect(p.label).toBe(DAY_CTA_VIEW_LIST_LABEL)
    p.press()
    expect(goToList).toHaveBeenCalledTimes(1)
    expect(openSheet).not.toHaveBeenCalled()
  })

  it('6 · ไม่มีเลย · เลยเวลาหมด → expired · กดไม่ได้', () => {
    const { p, goToList, openSheet } = cta({ yams: [PAST_A, PAST_B], addedYamIds: [] })
    expect(p.kind).toBe('expired')
    expect(p.label).toBe(DAY_CTA_EXPIRED_LABEL)
    expect(p.disabled).toBe(true)
    p.press()
    expect(goToList).not.toHaveBeenCalled()
    expect(openSheet).not.toHaveBeenCalled()
  })

  // #359 — คำตอบของสถานะล็อกเปลี่ยนจาก "พูดว่าเร็วๆ นี้" เป็น "พาไปหน้าแพ็กเกจ" เพราะปลายทางมีแล้ว
  // 🔴 สิ่งที่ห้ามเปลี่ยนคือครึ่งแรก: ล็อกแล้ว **ไม่มีเส้นทางถึง openSheet** — นั่นคือด่านของ #326
  it('7 · free (false) → locked · ชนะทุกอย่าง · กดแล้วพาไปหน้าแพ็กเกจ ❌ ไม่เปิดชีท', () => {
    const { p, openSheet, goToShop } = cta({ isPaid: false, yams: [FUTURE_A] })
    expect(p.kind).toBe('locked')
    expect(p.locked).toBe(true)
    expect(p.label).toBe(DAY_CTA_LOCKED_LABEL)
    p.press()
    expect(openSheet).not.toHaveBeenCalled()
    expect(goToShop).toHaveBeenCalledTimes(1)
  })

  it('7 fail-closed · null (ยังไม่รู้ tier) → locked ❌ ไม่ใช่ปลดล็อก', () => {
    const { p } = cta({ isPaid: null, yams: [FUTURE_A] })
    expect(p.kind).toBe('locked')
    expect(p.locked).toBe(true)
  })

  it('🔑 precedence · locked ชนะ saving+justSaved+aggregate', () => {
    const { p, openSheet, goToShop } = cta({
      isPaid: null,
      saving: true,
      justSaved: true,
      yams: [FUTURE_A, FUTURE_B],
      addedYamIds: [],
    })
    expect(p.kind).toBe('locked')
    p.press()
    expect(openSheet).not.toHaveBeenCalled()
    expect(goToShop).toHaveBeenCalledTimes(1)
  })

  it('🔑 precedence · saving ชนะ justSaved และ aggregate (เลยเวลาหมด)', () => {
    const { p } = cta({ saving: true, justSaved: true, yams: [PAST_A, PAST_B] })
    expect(p.kind).toBe('saving')
  })

  it('🔑 precedence · justSaved ชนะ aggregate (ยังเพิ่มได้)', () => {
    const { p } = cta({ justSaved: true, yams: [FUTURE_A], addedYamIds: [] })
    expect(p.kind).toBe('justSaved')
  })

  it('🔑 tie-break ระดับปุ่ม · ยามเดียวที่ทั้งเพิ่มแล้ว+เลยเวลา → viewList (added ชนะ ไม่ใช่ expired)', () => {
    const { p } = cta({ yams: [PAST_A], addedYamIds: ['y3'] })
    expect(p.kind).toBe('viewList')
  })

  it('ขอบ · ไม่มียามเลย (yams=[]) → expired กดไม่ได้ (fail-safe)', () => {
    const { p } = cta({ yams: [], addedYamIds: [] })
    expect(p.kind).toBe('expired')
    expect(p.disabled).toBe(true)
  })
})

// ─── addedYamIdsForDate — pure ──────────────────────────────────────────────
describe('#341 · addedYamIdsForDate — ยามไหนของวันไหนเพิ่มแล้ว', () => {
  const dto = (id: string, date: string, yamId: string): ReminderDTO => ({
    id, date, yamId, yamLabel: `ยาม ${yamId}`, window: '05:00-06:59',
    destinations: ['mumate'], fireAtUtc: '2026-08-20T00:00:00.000Z',
  })

  it('กรองเฉพาะวันที่ถาม + คืน yamId', () => {
    const rows = [dto('a', DATE, 'y2'), dto('b', DATE, 'y5'), dto('c', '2026-08-21', 'y1')]
    expect(addedYamIdsForDate(rows, DATE).sort()).toEqual(['y2', 'y5'])
    expect(addedYamIdsForDate(rows, '2026-08-21')).toEqual(['y1'])
    expect(addedYamIdsForDate(rows, '2026-08-22')).toEqual([])
  })
  it('de-dupe yamId ซ้ำในวันเดียว (retry/replay)', () => {
    const rows = [dto('a', DATE, 'y2'), dto('b', DATE, 'y2')]
    expect(addedYamIdsForDate(rows, DATE)).toEqual(['y2'])
  })
})

// ─── ฮุค: จุดที่ TS ยันไม่ได้ ─────────────────────────────────────────────────
describe('#341 · useReminderDraft.open — ติ๊กยามล่วงหน้า', () => {
  it('ส่ง yamIds → ติ๊กไว้ (de-dupe) · ไม่ส่ง → ว่างเหมือนเดิม', () => {
    const { result } = renderHook(() => useReminderDraft())
    act(() => result.current.open(DATE, ['y2', 'y3', 'y2']))
    expect(result.current.draft.date).toBe(DATE)
    expect(result.current.draft.selectedYamIds).toEqual(['y2', 'y3'])
    act(() => result.current.open('2026-08-21'))
    expect(result.current.draft.selectedYamIds).toEqual([])
  })
})

describe('#341 · useReminders.addedYamIdsFor — เปิดเผยจริงจากฮุค', () => {
  const res = (status: number, body: unknown): Response =>
    ({ ok: status >= 200 && status < 300, status, json: () => Promise.resolve(body) }) as Response
  const dto = (id: string, date: string, yamId: string): ReminderDTO => ({
    id, date, yamId, yamLabel: `ยาม ${yamId}`, window: '05:00-06:59',
    destinations: ['mumate'], fireAtUtc: '2026-08-20T00:00:00.000Z',
  })
  afterEach(() => vi.restoreAllMocks())

  it('หลังโหลด → ตอบยามของวันนั้นได้ (ไม่ใช่แค่ hasReminderFor ระดับวัน)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => res(200, { reminders: [dto('a', DATE, 'y2'), dto('b', DATE, 'y5')] })),
    )
    const { result } = renderHook(() => useReminders())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.addedYamIdsFor(DATE).sort()).toEqual(['y2', 'y5'])
    expect(result.current.addedYamIdsFor('2026-08-21')).toEqual([])
  })
})
