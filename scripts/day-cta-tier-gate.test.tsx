// #326 — ฟันของ "ทางเข้าที่สอง: ปุ่มหลักบนแถบล่าง"
//
// 🔴 ฟันนี้วัด **client ไม่มีเส้นทางไปถึงการเปิดชีท/ยิง POST เมื่อไม่ใช่สมาชิก** ❌ ไม่ใช่ "เซิร์ฟเวอร์ตอบ 403"
// เซิร์ฟเวอร์กัน free อยู่ก่อนแล้วและ fail-closed (pages/api/v2/reminders.ts:40-43) ⇒ ฟันที่วัดฝั่งนั้น
// จะเขียวอยู่แล้วก่อนใบนี้แตะอะไร = ฟันที่ไม่กัด (บทเรียนเดียวกับ #316)
//
// สองชั้น เพราะด่านของใบนี้มีสองที่ที่พังได้คนละแบบ:
//   ① ตัวตัดสิน (tier-lock.dayDetailCta) ตอบผิด
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
  dayDetailCta,
  DAY_CTA_LOCKED_LABEL,
  DAY_CTA_LOCKED_MESSAGE,
  DAY_CTA_OPEN_LABEL,
  DAY_CTA_SAVED_LABEL,
} from '@/features/v2-calendar/tier-lock'

describe('#326 ① ตัวตัดสิน — dayDetailCta', () => {
  const plan = (isPaid: boolean | null, saved = false) => {
    const openSheet = vi.fn()
    const say = vi.fn()
    const p = dayDetailCta({ isPaid, saved, openSheet, say })
    return { p, openSheet, say }
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

  it('NEGATIVE CONTROL · paid + บันทึกแล้ว → ป้ายเดิมของสถานะ saved ไม่ถูกกลืนหาย', () => {
    const { p } = plan(true, true)
    expect(p.label).toBe(DAY_CTA_SAVED_LABEL)
  })
})

// ───────────────────────── ชั้น ② ผู้เรียก ─────────────────────────
vi.mock('next/config', () => ({ default: () => ({ publicRuntimeConfig: {}, serverRuntimeConfig: {} }) }))
vi.mock('next/router', () => ({ useRouter: () => ({ query: { date: '2026-08-19' }, isReady: true, push: vi.fn() }) }))

const draftOpen = vi.fn()
let tier: boolean | null = false

vi.mock('@/features/v2-shell/hooks/useClientTier', () => ({ useClientTier: () => ({ isPaid: tier }) }))
vi.mock('@/features/v2-calendar', () => ({
  useDayDetail: () => ({ detail: { yams: [], compat: [], predictions: [], luckyColors: [] } }),
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
})
