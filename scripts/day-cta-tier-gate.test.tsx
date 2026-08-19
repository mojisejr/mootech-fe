// #326 — ฟันของ "ทางเข้าที่สอง: ปุ่มหลักบนแถบล่าง"
//
// 🔴 ฟันนี้วัด **client ไม่มีเส้นทางไปถึงการเปิดชีท/ยิง POST เมื่อไม่ใช่สมาชิก** ❌ ไม่ใช่ "เซิร์ฟเวอร์ตอบ 403"
// เซิร์ฟเวอร์กัน free อยู่ก่อนแล้วและ fail-closed (pages/api/v2/reminders.ts:40-43) ⇒ ฟันที่วัดฝั่งนั้น
// จะเขียวอยู่แล้วก่อนใบนี้แตะอะไร = ฟันที่ไม่กัด (บทเรียนเดียวกับ #316)
//
// สองชั้น เพราะด่านของใบนี้มีสองที่ที่พังได้คนละแบบ:
//   ① ตัวตัดสิน (tier-lock.dayReminderCta) ตอบผิด
//   ② ตัวตัดสินถูก แต่ **หน้าเพจไม่ได้เรียกมัน** — นี่คือช่องที่ #324 เจอใน #316 (ฟันเฝ้าแต่ component
//      แล้วถอดฟีเจอร์ออกจากหน้าเพจได้โดยไม่มีอะไรแดง) ⇒ ชั้น ② เรนเดอร์ **หน้าเพจจริง**
//
// ท่าที่ทำให้ชั้น ② เป็นไปได้: stub next/config (หน้าเพจลาก getConfig() ตอน import) — ท่าเดียวกับ
// scripts/tier-prod-pages.test.tsx:17 · #316 สรุปว่า "unit test import หน้าเพจไม่ได้" ซึ่งจริงตอนนั้น
// แต่ในรีโปนี้มีท่าอยู่แล้ว ⇒ ด่านของผู้เรียกไม่ต้องฝากไว้กับคอมไพเลอร์อย่างเดียวอีก
import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import {
  dayReminderCta,
  DAY_CTA_LOCKED_LABEL,
  DAY_CTA_LOCKED_MESSAGE,
  DAY_CTA_OPEN_LABEL,
  DAY_CTA_ADD_MORE_LABEL,
  DAY_CTA_VIEW_LIST_LABEL,
  DAY_CTA_EXPIRED_LABEL,
  DAY_CTA_JUST_SAVED_LABEL,
} from '@/features/v2-calendar/tier-lock'
import type { YamSlot } from '@/features/v2-calendar/types'

// #343 — ฟันนี้ย้ายบ้านจาก `dayDetailCta` (ถูกลบ) มาที่ `dayReminderCta` ❌ ไม่ได้ถูกลบทิ้ง
// สิ่งที่ **ต้องไม่หาย** ตอนย้าย: เคส locked (free/null ⇒ ไม่มีเส้นทางถึง openSheet) และ **ชั้น ②
// ที่เรนเดอร์หน้าเพจจริง** ซึ่งเป็นตัวที่ปิดช่องที่ #324 เจอ (ฟันเฝ้า component แล้วถอดฟีเจอร์ออกจาก
// เพจได้โดยไม่มีอะไรแดง) — ด่านที่แคบลงตอนย้ายบ้าน คือด่านที่หายไปเงียบๆ

const DATE = '2026-08-20'
const NOW = new Date('2026-08-19T00:00:00Z') // ก่อนวันนั้นทั้งวัน ⇒ ทุกยาม "ยังไม่เลยเวลา"
const yam = (id: string, window: string): YamSlot => ({ id, window, label: `ยาม ${id}` } as YamSlot)
const YAMS = [yam('y1', '09:00-10:59'), yam('y2', '19:00-20:59')]

describe('#326 ① ตัวตัดสิน — dayReminderCta', () => {
  const plan = (isPaid: boolean | null, over: Partial<Parameters<typeof dayReminderCta>[0]> = {}) => {
    const openSheet = vi.fn()
    const say = vi.fn()
    const goToList = vi.fn()
    const p = dayReminderCta({
      isPaid,
      saving: false,
      justSaved: false,
      yams: YAMS,
      addedYamIds: [],
      date: DATE,
      now: NOW,
      openSheet,
      say,
      goToList,
      ...over,
    })
    return { p, openSheet, say, goToList }
  }

  it('free (false) → กดแล้วไม่มีทางถึง openSheet · พูดว่าเป็นของสมาชิก', () => {
    const { p, openSheet, say } = plan(false)
    expect(p.locked).toBe(true)
    expect(p.label).toBe(DAY_CTA_LOCKED_LABEL)
    p.press()
    expect(openSheet).not.toHaveBeenCalled()
    expect(say).toHaveBeenCalledWith(DAY_CTA_LOCKED_MESSAGE)
  })

  it('ยังไม่รู้ tier (null) → ล็อกเหมือน free (fail-closed) ❌ ไม่ใช่ปลดล็อก', () => {
    const { p, openSheet, say } = plan(null)
    expect(p.locked).toBe(true)
    p.press()
    expect(openSheet).not.toHaveBeenCalled()
    expect(say).toHaveBeenCalledTimes(1)
  })

  it('NEGATIVE CONTROL · paid (true) → เปิดชีทเหมือนเดิม ไม่มี toast', () => {
    const { p, openSheet, say } = plan(true)
    expect(p.locked).toBe(false)
    expect(p.label).toBe(DAY_CTA_OPEN_LABEL)
    p.press()
    expect(openSheet).toHaveBeenCalledTimes(1)
    expect(say).not.toHaveBeenCalled()
  })

  it('NEGATIVE CONTROL · paid + เพิ่มไปแล้วบางยาม → "เพิ่มยาม" ❌ ไม่ใช่ป้ายที่บอกว่าเสร็จแล้ว', () => {
    // นี่คือบรรทัดแรกของ DoD ใบ #343 — ของเดิมเขียน "คุณบันทึกลงปฏิทินแล้ว" ทั้งที่ยังกดเพิ่มได้อีก
    const { p, openSheet } = plan(true, { addedYamIds: ['y1'] })
    expect(p.kind).toBe('addMore')
    expect(p.label).toBe(DAY_CTA_ADD_MORE_LABEL)
    p.press()
    expect(openSheet).toHaveBeenCalledTimes(1)
  })

  it('paid + เพิ่มครบทุกยาม → "ดูการแจ้งเตือนของวันนี้" · กดไปหน้ารายการ ❌ ไม่เปิดชีทที่ทุกช่องตาย', () => {
    const { p, openSheet, goToList } = plan(true, { addedYamIds: ['y1', 'y2'] })
    expect(p.label).toBe(DAY_CTA_VIEW_LIST_LABEL)
    p.press()
    expect(goToList).toHaveBeenCalledTimes(1)
    expect(openSheet).not.toHaveBeenCalled()
  })

  it('🔴 3 สถานะที่กดไม่ได้ ต้องรายงาน disabled จริง — ไม่งั้นปุ่มจะกดได้ทั้งที่ press เป็น no-op', () => {
    expect(plan(true, { saving: true }).p.disabled).toBe(true)
    expect(plan(true, { justSaved: true }).p.disabled).toBe(true)
    expect(plan(true, { now: new Date('2027-01-01T00:00:00Z') }).p.disabled).toBe(true) // เลยเวลาหมด
  })

  it('เพิ่งบันทึกเสร็จ → "บันทึกเรียบร้อยแล้ว" (ชั่วคราว) และ เลยเวลาหมด → "เลยเวลาบันทึกแล้ว"', () => {
    expect(plan(true, { justSaved: true }).p.label).toBe(DAY_CTA_JUST_SAVED_LABEL)
    expect(plan(true, { now: new Date('2027-01-01T00:00:00Z') }).p.label).toBe(DAY_CTA_EXPIRED_LABEL)
  })

  it('🔴 NEGATIVE CONTROL · 6 สถานะที่ paid เข้าถึงได้ ให้ป้ายไม่ซ้ำกันเลย', () => {
    const labels = [
      plan(true).p.label,                                                    // 1 open
      plan(true, { saving: true }).p.label,                                  // 2 saving
      plan(true, { justSaved: true }).p.label,                               // 3 justSaved
      plan(true, { addedYamIds: ['y1'] }).p.label,                           // 4 addMore
      plan(true, { addedYamIds: ['y1', 'y2'] }).p.label,                     // 5 viewList
      plan(true, { now: new Date('2027-01-01T00:00:00Z') }).p.label,         // 6 expired
    ]
    expect(new Set(labels).size).toBe(6)
  })
})

// ───────────────────────── ชั้น ② ผู้เรียก ─────────────────────────
vi.mock('next/config', () => ({ default: () => ({ publicRuntimeConfig: {}, serverRuntimeConfig: {} }) }))
// วันที่ในอนาคตพอที่ยามจะ "ยังไม่เลยเวลา" เสมอ ไม่ว่าจะรันวันไหน ❌ ไม่พึ่งนาฬิกาผนัง
vi.mock('next/router', () => ({ useRouter: () => ({ query: { date: '2099-01-01' }, isReady: true, push: vi.fn() }) }))

const draftOpen = vi.fn()
let tier: boolean | null = false

vi.mock('@/features/v2-shell/hooks/useClientTier', () => ({ useClientTier: () => ({ isPaid: tier }) }))
vi.mock('@/features/v2-calendar', () => ({
  // 🔴 yams ต้อง **ไม่ว่าง** — dayReminderCta อ่าน yams เพื่อ aggregate 7 สถานะ และวันที่ไม่มียามเลย
  // คือเคส 6 (expired · กดไม่ได้) ⇒ mock ที่ให้ [] จะทำให้ชั้น ② ทดสอบสถานะที่ผู้ใช้จริงไม่เคยเจอ
  // (almanac ให้ luckyHours เสมอ) แล้วเขียวโดยไม่ได้แตะเส้นทางจริง
  useDayDetail: () => ({
    detail: {
      yams: [{ id: 'y1', window: '09:00-10:59', label: 'ยาม y1' }],
      compat: [], predictions: [], luckyColors: [],
    },
  }),
  useAdvancedMode: () => ({ advanced: false, toggle: vi.fn() }),
  // 🔴 รูปของ mock ลอกจากของจริง ไม่ใช่เดา: useReminders คืน
  //   { list, loading, error, hasReminderFor, refresh, save, cancel }  (useReminders.ts:89)
  //   และหน้าเพจอ่าน list.upcoming / list.past ที่ [date].tsx:123
  // mock ที่ใจกว้างกว่าของจริงจะเปลี่ยน "ล้มดัง" ให้เป็น "ผ่านเงียบ" ตอนสัญญาฝั่งนั้นเปลี่ยน
  useReminders: () => ({
    list: { upcoming: [], past: [] },
    loading: false,
    error: null,
    hasReminderFor: () => false,
    // #343 — ของจริงมี addedYamIdsFor (useReminders.ts:30) และหน้าเพจเรียกมัน · mock ที่ขาดตัวนี้
    // จะพังเป็น TypeError ซึ่งอ่านไม่ออกว่าเป็น "สัญญาเปลี่ยน" ⇒ ซ่อม mock ให้ตรงของจริง
    addedYamIdsFor: () => [],
    refresh: vi.fn(),
    save: vi.fn(),
    cancel: vi.fn(),
  }),
  useReminderDraft: () => ({
    open: draftOpen,
    state: 'idle',
    draft: { selectedYamIds: [] },
    menuState: 'form',
    cancel: vi.fn(),
  }),
  menuStateForDay: () => 'primary-cta',
}))
// ลูกๆ ของหน้าไม่ใช่สิ่งที่ฟันนี้วัด — stub ให้เบา แต่ **ไม่ stub CalendarShell** เพราะปุ่มที่เราจะกดอยู่ในนั้น
for (const m of [
  'DayHeader', 'DayStrip', 'DayScoreCard', 'AdvancedToggle', 'CompatList',
  'PredictionCards', 'LuckyColors', 'YamTimes', 'MyChart', 'Dithi', 'EightGates', 'EightDeities', 'SaveSheet',
]) {
  vi.doMock(`@/features/v2-calendar/components/day-detail/${m}`, () => ({ [m]: () => null }))
}
vi.mock('@/features/v2-calendar/components/InstallGuideSheet', () => ({ InstallGuideSheet: () => null }))
vi.mock('@/lib/pwa/capability', () => ({ usePwaCapability: () => ({ installed: true, canPush: true, permission: 'granted' }) }))
vi.mock('@/lib/pwa/subscribe', () => ({ requestPushSubscription: vi.fn() }))
vi.mock('@/lib/pwa/persist-subscription', () => ({ saveWithNotification: vi.fn(), postPushSubscription: vi.fn() }))

describe('#326 ② ผู้เรียก — หน้ารายละเอียดวันต้องเรียกตัวตัดสินจริง', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    draftOpen.mockClear()
  })
  afterEach(() => {
    vi.advanceTimersByTime(5000)
    cleanup()
    vi.useRealTimers()
  })

  const mountPage = async () => {
    const mod = await import('@/pages/v2/calendar/[date]')
    const Page = mod.default
    render(<Page teamPreview={false} />)
  }

  it('free → ปุ่มแถบล่างบอกว่าเป็นของสมาชิก และกดแล้ว draft.open ไม่ถูกเรียกเลย', async () => {
    tier = false
    await mountPage()
    const cta = screen.getByRole('button', { name: new RegExp(DAY_CTA_LOCKED_LABEL) })
    fireEvent.click(cta)
    expect(draftOpen).not.toHaveBeenCalled()
    expect(screen.getByTestId('coming-soon-toast').textContent).toBe(DAY_CTA_LOCKED_MESSAGE)
  })

  it('NEGATIVE CONTROL · paid → กดแล้ว draft.open ถูกเรียก 1 ครั้ง', async () => {
    tier = true
    await mountPage()
    fireEvent.click(screen.getByRole('button', { name: new RegExp(DAY_CTA_OPEN_LABEL) }))
    expect(draftOpen).toHaveBeenCalledTimes(1)
  })

  // #343 — ด่านของ **ผู้เรียก** สำหรับ `ctaDisabled` โดยเฉพาะ
  // 🔴 บทเรียนของ #324: `dayReminderCta` คืน `disabled:true` ถูกต้องได้ และ `Menubar` รับ `ctaDisabled`
  // ได้ถูกต้อง **แต่ถ้าหน้าเพจไม่ส่งค่าต่อ ปุ่มก็ยังกดได้อยู่ดี** และฟันของสองฝั่งนั้นเขียวทั้งคู่
  // ⇒ ข้อนี้เรนเดอร์เพจจริงในสถานะที่ปุ่มต้องกดไม่ได้ แล้วอ่านจากปุ่มจริงบนจอ
  it('🔴 paid + เลยเวลาหมด → ปุ่มบนหน้าเพจจริง **กดไม่ได้** (ถอด ctaDisabled ออกจากเพจ ⇒ ข้อนี้แดง)', async () => {
    tier = true
    // ยามเดียวของ mock คือ 09:00-10:59 ของวันที่ 2099-01-01 · ตั้งนาฬิกาไว้หลังจากนั้น ⇒ kind 'expired'
    vi.setSystemTime(new Date('2099-06-01T00:00:00Z'))
    await mountPage()
    const btn = screen.getByRole('button', { name: new RegExp(DAY_CTA_EXPIRED_LABEL) }) as HTMLButtonElement
    expect(btn.disabled).toBe(true)
    fireEvent.click(btn)
    expect(draftOpen).not.toHaveBeenCalled()
  })
})
