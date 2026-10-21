// scripts/course-grant.test.tsx — สิทธิ์คอร์สจากแอดมิน/โค้ด + หน้ารับคอร์ส (เอ็ม 2026-10-21)
//   CG1 แอดมินให้สิทธิ์ / แลกโค้ด (bazi_entitlement kind=course) = เข้าเรียนได้ via 'grant' · ซื้อเองยังมาก่อน · ไม่มีอะไรเลย = ไม่มีสิทธิ์
//   CG2 หน้ารับคอร์ส: ยังไม่ล็อกอิน → ปุ่มเข้าสู่ระบบ + จำโค้ด · ล็อกอินแล้ว → แลก → เข้าเรียน · โค้ดผิด → แจ้ง
import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'

let purchased = false
let granted = false
vi.mock('@/lib/db', () => ({
  db: {
    execute: vi.fn(async (q: { queryChunks?: unknown[] }) => {
      const text = JSON.stringify(q?.queryChunks ?? q)
      if (text.includes('bazi_entitlement')) return { rows: granted ? [{ x: 1 }] : [] }
      if (text.includes('v2_payment') && text.includes('package_code')) return { rows: purchased ? [{ x: 1 }] : [] }
      return { rows: [] }
    }),
  },
}))
let authStatus: 'anon' | 'authed' | 'loading' = 'anon'
vi.mock('@/lib/auth/use-current-user', () => ({ useCurrentUser: () => ({ status: authStatus, userId: authStatus === 'authed' ? 'U1' : null }) }))
const push = vi.fn()
let query: Record<string, string> = { code: 'WTD-ABC123' }
vi.mock('next/router', () => ({ useRouter: () => ({ query, isReady: true, push, replace: vi.fn(), pathname: '/course/redeem', asPath: '/course/redeem' }) }))

import { courseAccessFor } from '@/lib/course/access'
import CourseRedeemPage from '@/pages/course/redeem'
import { COURSE_REDEEM_KEY } from '@/features/course/redeem'

beforeEach(() => { purchased = false; granted = false; authStatus = 'anon'; push.mockClear(); localStorage.clear(); query = { code: 'WTD-ABC123' } })
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

describe('สิทธิ์คอร์สจากแอดมิน/โค้ด', () => {
  it('CG1 grant = เข้าได้ · ซื้อเองมาก่อน · ไม่มีอะไร = ไม่ได้', async () => {
    expect(await courseAccessFor('calendar', 'U1')).toEqual({ access: false, via: null })
    granted = true
    expect(await courseAccessFor('calendar', 'U1')).toEqual({ access: true, via: 'grant' })
    purchased = true
    expect(await courseAccessFor('calendar', 'U1')).toEqual({ access: true, via: 'purchase' })
    expect(await courseAccessFor('calendar', null)).toEqual({ access: false, via: null })
  })
})

describe('หน้ารับคอร์ส /course/redeem', () => {
  it('CG2a ยังไม่ล็อกอิน: โชว์โค้ดจากลิงก์ + ปุ่มเข้าสู่ระบบ (จำโค้ดไว้)', async () => {
    render(<CourseRedeemPage />)
    await waitFor(() => expect((screen.getByTestId('course-redeem-code') as HTMLInputElement).value).toBe('WTD-ABC123'))
    fireEvent.click(screen.getByTestId('course-redeem-login'))
    expect(localStorage.getItem(COURSE_REDEEM_KEY)).toBe('WTD-ABC123')
    expect(push).toHaveBeenCalledWith('/v2/login')
  })

  it('CG2b ล็อกอินแล้ว (โค้ดที่จำไว้): รับคอร์ส → สำเร็จ → ปุ่มเข้าเรียนไปคอร์สที่ได้สิทธิ์', async () => {
    authStatus = 'authed'; query = {}; localStorage.setItem(COURSE_REDEEM_KEY, 'WTD-ABC123')
    const fetchMock = vi.fn(async (url: string) => {
      if (url === '/api/coupon-redeem') return { ok: true, json: async () => ({ ok: true, reward: 'คอร์ส Win the Day (คอร์สปฏิทิน)' }) }
      if (url === '/api/course/calendar') return { ok: true, json: async () => ({ access: true }) }
      return { ok: true, json: async () => ({ access: false }) }
    })
    vi.stubGlobal('fetch', fetchMock)
    render(<CourseRedeemPage />)
    await waitFor(() => expect((screen.getByTestId('course-redeem-code') as HTMLInputElement).value).toBe('WTD-ABC123'))
    fireEvent.click(screen.getByTestId('course-redeem-btn'))
    await waitFor(() => expect(screen.getByTestId('course-redeem-ok').textContent).toContain('Win the Day'))
    expect(screen.getByTestId('course-redeem-go').getAttribute('href')).toBe('/course/calendar')
    expect(localStorage.getItem(COURSE_REDEEM_KEY)).toBeNull()
  })

  it('CG2c โค้ดผิด → แจ้งข้อความจาก engine', async () => {
    authStatus = 'authed'
    vi.stubGlobal('fetch', vi.fn(async (url: string) => (url === '/api/coupon-redeem'
      ? { ok: true, json: async () => ({ ok: false, reason: 'NOT_FOUND', message: 'ไม่พบโค้ดนี้' }) }
      : { ok: true, json: async () => ({ access: false }) })))
    render(<CourseRedeemPage />)
    await waitFor(() => expect(screen.getByTestId('course-redeem-btn')).toBeTruthy())
    fireEvent.click(screen.getByTestId('course-redeem-btn'))
    await waitFor(() => expect(screen.getByTestId('course-redeem-error').textContent).toBe('ไม่พบโค้ดนี้'))
  })
})
