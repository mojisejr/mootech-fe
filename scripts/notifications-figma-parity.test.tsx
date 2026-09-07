// Figma parity 2026-09-07 — "การแจ้งเตือนทั้งหมด" (636:10221 / 421:901) → pages/v2/calendar/notifications.tsx
//
// What is guarded: the frame's COPY and structure, read from goo's useReminders (never invented):
//   • teal ground + white title + close chip (no back arrow)
//   • navy status card "ตั้งแจ้งเตือนแล้ว · N ยาม"; the Google line ONLY when a row really has 'google'
//   • push preview "⏰ ยามมงคลเริ่มแล้ว · <window>" for the NEXT upcoming reminder, absent when none
//   • one event card per reminder: "🔮 ยามมงคล — <label>" · "อ. 14 ก.ค. 2569 · 09:00 – 10:59" · chip
//   • the pre-existing testids (notif-row / notif-cancel / notif-total-yams / notif-empty) still resolve
import React from 'react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { CookiesProvider } from 'react-cookie'
import type { Reminder } from '@/features/v2-calendar/types'

vi.mock('next/config', () => ({ default: () => ({ publicRuntimeConfig: {}, serverRuntimeConfig: {} }) }))
vi.mock('next/router', () => ({ useRouter: () => ({ query: {}, isReady: true, push: vi.fn(), pathname: '/v2/calendar/notifications' }) }))
vi.mock('next/head', () => ({ default: ({ children }: { children: React.ReactNode }) => <>{children}</> }))
vi.mock('@/features/v2-shell/hooks/useClientTier', () => ({ useClientTier: () => ({ isPaid: false, tier: null }) }))
vi.mock('@/features/v2-calendar/components/InstallGuideSheet', () => ({ InstallGuideSheet: () => null }))
vi.mock('@/lib/pwa/capability', () => ({ usePwaCapability: () => ({ installed: true, canPush: true, permission: 'granted' }), CAPABILITY_CHANGED: 'capability-changed' }))
vi.mock('@/lib/pwa/subscribe', () => ({ requestPushSubscription: vi.fn() }))

const cancel = vi.fn()
let upcoming: Reminder[] = []
let past: Reminder[] = []
vi.mock('@/features/v2-calendar', async () => {
  const { CalendarMenuState } = await import('@/features/v2-calendar/menu-state')
  return {
    CalendarMenuState,
    useReminders: () => ({
      list: { upcoming, past, totalYams: upcoming.length + past.length, totalDays: new Set([...upcoming, ...past].map((r) => r.date)).size },
      cancel,
    }),
  }
})

const rem = (over: Partial<Reminder>): Reminder => ({
  id: 'r1',
  date: '2026-07-14', // อังคาร
  yamId: 'y3',
  yamLabel: 'มีลาภผล ทรัพย์สิน เงินทอง',
  window: '09:00-10:59',
  destinations: ['mumate'],
  group: 'upcoming',
  ...over,
})

async function renderPage() {
  const mod = await import('@/pages/v2/calendar/notifications')
  const Page = mod.default
  return render(<CookiesProvider><Page teamPreview={false} /></CookiesProvider>)
}

afterEach(() => {
  cleanup()
  cancel.mockReset()
  upcoming = []
  past = []
})

describe('636:10221 — header', () => {
  it('white title on the teal ground + a close chip back to the calendar (no back arrow)', async () => {
    await renderPage()
    const title = screen.getByTestId('header-title')
    expect(title.textContent).toBe('การแจ้งเตือนทั้งหมด')
    expect(title.className).toContain('text-white')
    const close = screen.getByTestId('notif-close')
    expect(close.getAttribute('href')).toBe('/v2/calendar')
    expect(close.className).toContain('bg-[#1190A5]')
    expect(screen.queryByTestId('header-back')).toBeNull()
  })
})

describe('636:10235 — status card', () => {
  it('reads the count from useReminders; the Google line only when a row really targets google', async () => {
    upcoming = [rem({ id: 'a' }), rem({ id: 'b', yamId: 'y4', window: '19:00-20:59', yamLabel: 'ก้าวหน้ารุ่งเรือง' })]
    await renderPage()
    expect(screen.getByTestId('notif-total-yams').textContent).toBe('2')
    expect(screen.queryByText('เพิ่มลง Google ปฏิทิน เรียบร้อย')).toBeNull()
    expect(screen.getByText(/แจ้งเตือนในแอป Mumate ·/).textContent).toContain('1 วัน')
    cleanup()
    upcoming = [rem({ id: 'a', destinations: ['mumate', 'google'] })]
    await renderPage()
    expect(screen.getByText('เพิ่มลง Google ปฏิทิน เรียบร้อย')).toBeTruthy()
  })

  it('is hidden in the empty state (no "0 ยาม" above "ยังไม่มีการแจ้งเตือน")', async () => {
    await renderPage()
    expect(screen.queryByTestId('notif-total-yams')).toBeNull()
    expect(screen.getByTestId('notif-empty')).toBeTruthy()
    expect(screen.queryByTestId('notif-push-preview')).toBeNull()
  })
})

describe('636:10241 — push preview mocks the NEXT reminder', () => {
  it('"⏰ ยามมงคลเริ่มแล้ว · <window>" + the yam label, from the first upcoming row', async () => {
    upcoming = [rem({ id: 'a' }), rem({ id: 'b', window: '19:00-20:59', yamLabel: 'ก้าวหน้ารุ่งเรือง' })]
    await renderPage()
    const preview = screen.getByTestId('notif-push-preview')
    expect(preview.textContent).toContain('Mumate')
    expect(preview.textContent).toContain('ตอนนี้')
    expect(preview.textContent).toContain('⏰ ยามมงคลเริ่มแล้ว · 09:00-10:59')
    expect(preview.textContent).toContain('มีลาภผล ทรัพย์สิน เงินทอง')
    expect(preview.textContent).not.toContain('19:00-20:59')
  })

  it('past-only list → no push preview (nothing will ring)', async () => {
    past = [rem({ id: 'p', group: 'past' })]
    await renderPage()
    expect(screen.queryByTestId('notif-push-preview')).toBeNull()
  })
})

describe('636:10250 — event card per reminder', () => {
  it('"🔮 ยามมงคล — <label>" · "อ. 14 ก.ค. 2569 · 09:00 – 10:59" · open link · in-app chip · cancel', async () => {
    upcoming = [rem({ id: 'a' })]
    await renderPage()
    const row = screen.getByTestId('notif-row')
    expect(row.textContent).toContain('🔮 ยามมงคล — มีลาภผล ทรัพย์สิน เงินทอง')
    expect(row.textContent).toContain('อ. 14 ก.ค. 2569 · 09:00 – 10:59')
    expect(row.textContent).toContain('เปิดใน Mumate ›')
    expect(row.querySelector('a')?.getAttribute('href')).toBe('/v2/calendar/2026-07-14')
    expect(row.textContent).toContain('🔔 แจ้งเตือนในแอป Mumate')
    expect(row.textContent).not.toContain('Google')
    fireEvent.click(screen.getByTestId('notif-cancel'))
    expect(cancel).toHaveBeenCalledWith('a')
  })

  it('a google-destination row gets the Figma chip "📅 Google ปฏิทิน · จาก Mumate"', async () => {
    upcoming = [rem({ id: 'a', destinations: ['mumate', 'google'] })]
    await renderPage()
    expect(screen.getByTestId('notif-row').textContent).toContain('📅 Google ปฏิทิน · จาก Mumate')
  })

  it('past rows: faded, no cancel button', async () => {
    past = [rem({ id: 'p', group: 'past' })]
    await renderPage()
    const row = screen.getByTestId('notif-row')
    expect(row.className).toContain('opacity-60')
    expect(screen.queryByTestId('notif-cancel')).toBeNull()
    expect(screen.getByText('เตือนไปแล้ว')).toBeTruthy()
  })
})

describe('thaiEventDate', () => {
  it('weekday abbr + day + month abbr + พ.ศ.', async () => {
    const { thaiEventDate } = await import('@/pages/v2/calendar/notifications')
    expect(thaiEventDate('2026-07-14')).toBe('อ. 14 ก.ค. 2569')
    expect(thaiEventDate('2026-01-04')).toBe('อา. 4 ม.ค. 2569')
    expect(thaiEventDate('bad')).toBe('bad')
  })
})
