// scripts/qi-checkin-screen.test.tsx — จอเช็คอินเต็ม (/v2/qi/checkin, เฟรม check-in — states)
//
// 🔴 MUTANT CONTRACT:
//   C1 เช็คอินแล้ววันนี้ ❌ ปุ่มกดซ้ำได้ + hero ต้องบอก "กลับมาใหม่พรุ่งนี้"
//   C2 สตรีคนับจากประวัติเขตไทยเท่านั้น — ยังไม่กดวันนี้แต่เมื่อวานกด = สตรีคยังไม่หัก
import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'

vi.mock('next/config', () => ({ default: () => ({ publicRuntimeConfig: {}, serverRuntimeConfig: {} }) }))
vi.mock('next/router', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), query: {}, pathname: '/v2/qi/checkin', isReady: true }),
}))

// ตัดรอบวันที่ 2026-09-03 (ไทย) — กันเฟลตอนข้ามเที่ยงคืน
vi.mock('@/features/v2-qi/qi-model', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/v2-qi/qi-model')>()
  return { ...actual, todayBangkok: () => '2026-09-03' }
})

let walletHistory: Array<{ id: number; qiDelta: number; reason: string; createdAt: string }> = []
const fetchMock = vi.fn(async (url: string, init?: { method?: string }) => {
  const u = String(url)
  if (u.includes('/api/qi-wallet')) {
    return { ok: true, status: 200, json: async () => ({ qi: 10, coins: 0, xp: 0, level: 1, history: walletHistory }) }
  }
  if (u.includes('/api/qi-catalog')) {
    return {
      ok: true, status: 200,
      json: async () => ({ earn: [{ code: 'daily_login', qi: 5, limit: 'daily', title: 'เข้าใช้งานรายวัน', note: '' }], spend: [] }),
    }
  }
  if (u.includes('/api/qi-earn')) return { ok: true, status: 200, json: async () => ({ capped: false, awarded: true, qi: 5 }) }
  return { ok: true, status: 200, json: async () => ({}) }
})
vi.stubGlobal('fetch', fetchMock)

import QiCheckinScreen from '@/features/v2-qi/components/QiCheckinScreen'

const day = (n: number) => `2026-09-${String(n).padStart(2, '0')}T01:00:00.000Z` // 08:00 ไทยของวัน n

beforeEach(() => {
  walletHistory = []
  fetchMock.mockClear()
})
afterEach(() => cleanup())

describe('จอเช็คอินรายวัน (check-in — states)', () => {
  it('ยังไม่เช็คอิน → ปุ่มเปิด กดแล้วยิง daily_login + strip โชว์วันที่เช็คอินแล้วด้วย ✓', async () => {
    walletHistory = [
      { id: 1, qiDelta: 5, reason: 'qi:earn:daily_login', createdAt: day(2) }, // เมื่อวาน (ไทย)
      { id: 2, qiDelta: 5, reason: 'qi:earn:daily_login', createdAt: day(1) },
    ]
    render(<QiCheckinScreen />)
    const btn = await waitFor(() => screen.getByTestId('qi-checkin-btn'))
    expect(btn.textContent).toContain('เช็คอินวันนี้')
    expect(screen.getByTestId(`qi-checkin-day-2026-09-02`).textContent).toBe('✓')
    fireEvent.click(btn)
    await waitFor(() => expect(fetchMock.mock.calls.some((c) => String(c[0]).includes('/api/qi-earn'))).toBe(true))
  })

  it('C1 เช็คอินแล้ววันนี้ → ปุ่มปิด + hero บอกกลับมาพรุ่งนี้ + สตรีคนับวันนี้ด้วย', async () => {
    walletHistory = [
      { id: 1, qiDelta: 5, reason: 'qi:earn:daily_login', createdAt: day(3) }, // วันนี้ (ไทย)
      { id: 2, qiDelta: 5, reason: 'qi:earn:daily_login', createdAt: day(2) },
    ]
    render(<QiCheckinScreen />)
    const btn = await waitFor(() => screen.getByTestId('qi-checkin-btn'))
    expect(btn.textContent).toContain('เช็คอินแล้ว')
    expect((btn as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByTestId('qi-checkin-streak').textContent).toContain('2')
    expect(screen.getByTestId('qi-checkin-hero').textContent).toContain('กลับมาใหม่พรุ่งนี้')
  })

  it('C2 ยังไม่กดวันนี้ (เมื่อวานกด 2 วันต่อเนื่อง) → สตรีคยังนับ 2 ไม่หัก', async () => {
    walletHistory = [
      { id: 1, qiDelta: 5, reason: 'qi:earn:daily_login', createdAt: day(2) },
      { id: 2, qiDelta: 5, reason: 'qi:earn:daily_login', createdAt: day(1) },
    ]
    render(<QiCheckinScreen />)
    await waitFor(() => expect(screen.getByTestId('qi-checkin-streak').textContent).toContain('2'))
    expect(screen.getByTestId('qi-checkin-hero').textContent).toContain('มาเช็คอินวันนี้เพื่อคุมสตรีคต่อ')
  })

  it('สตรีคหลุด (ข้ามวันไม่เช็คอิน) → นับเฉพาะช่วงต่อเนื่องล่าสุด', async () => {
    walletHistory = [
      { id: 1, qiDelta: 5, reason: 'qi:earn:daily_login', createdAt: day(3) }, // วันนี้
      // ขาด 09-01, 09-02
      { id: 2, qiDelta: 5, reason: 'qi:earn:daily_login', createdAt: day(1) }, // 08-31? — day(1)=2026-09-01 แต่เขตไทย 08:00 ของ 09-01
    ]
    // day(1) = 01:00Z ของ 09-01 = 08:00 ไทย 09-01 → ขาด 09-02 → สตรีค = 1 (วันนี้เท่านั้น)
    render(<QiCheckinScreen />)
    await waitFor(() => expect(screen.getByTestId('qi-checkin-streak').textContent).toContain('1'))
  })
})
