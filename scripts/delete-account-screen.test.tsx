// scripts/delete-account-screen.test.tsx — หน้า "ลบบัญชี" (มีตติ้งทีม: แจ้งสิ่งที่จะหาย + พัก 30 วัน)
//
// 🔴 MUTANT CONTRACT (แต่ละข้อทำ `npm test` แดงถ้าพัง):
//   D1  ปุ่มยืนยันต้อง disabled จนกว่าจะติ๊กยืนยัน          → "ปุ่มยืนยันกันตัวเอง" แดง
//   D2  501 จาก BFF ต้องโชว์ "ยังไม่เปิดใช้" — ห้ามมีข้อความ  → "501 โชว์ตรงไปตรงมา" แดง
//       สำเร็จลอย (ขาหลังยังไม่มี — ดู pages/api/v2/account/delete.ts)
//   D3  copy ต้องบอกเงื่อนไข 30 วัน และสิ่งที่จะหาย         → "copy ครบตามมีตติ้ง" แดง
import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'
import { CookiesProvider } from 'react-cookie'

vi.mock('next/config', () => ({ default: () => ({ publicRuntimeConfig: {}, serverRuntimeConfig: {} }) }))
// useV2Tier (ที่ #384 บังคับให้ AppHeader ผ่าน membership) ดึง useCurrentUser → next-auth useSession —
// mock เป็น unauthenticated ตรงตัว: ไฟล์นี้ไม่ได้ทดสอบสิทธิ์ ทดสอบ copy + ปุ่มกันตัวเอง + 501 honest
vi.mock('next-auth/react', () => ({ useSession: () => ({ data: null, status: 'unauthenticated' }) }))
vi.mock('next/router', () => ({
  useRouter: () => ({ pathname: '/v2/settings/delete-account', asPath: '/v2/settings/delete-account', route: '/v2/settings/delete-account', query: {}, isReady: true, push: vi.fn(), replace: vi.fn(), prefetch: vi.fn(() => Promise.resolve()), events: { on: vi.fn(), off: vi.fn(), emit: vi.fn() } }),
}))

import DeleteAccountPage from '@/pages/v2/settings/delete-account'

describe('delete-account screen', () => {
  let fetchMock: ReturnType<typeof vi.fn>
  beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('D3 copy ครบ: สิ่งที่จะหาย + พัก 30 วัน + ยกเลิกได้', () => {
    render(<CookiesProvider><DeleteAccountPage /></CookiesProvider>)
    expect(screen.getByText(/อะไรจะหาย/)).toBeTruthy()
    expect(screen.getByText(/พักบัญชี 30 วัน/)).toBeTruthy()
    expect(screen.getByText(/ยกเลิกการลบ/)).toBeTruthy()
    expect(screen.getByText(/ข้อมูลวันเกิดและผลดวง/)).toBeTruthy()
  })

  it('D1 ปุ่ม disabled จนกว่าจะติ๊กยืนยัน', () => {
    render(<CookiesProvider><DeleteAccountPage /></CookiesProvider>)
    const btn = screen.getByTestId('delete-submit') as HTMLButtonElement
    expect(btn.disabled).toBe(true)
    fireEvent.click(screen.getByTestId('delete-confirm-check'))
    expect((screen.getByTestId('delete-submit') as HTMLButtonElement).disabled).toBe(false)
  })

  it('D2 BFF 501 → โชว์ "ยังไม่เปิดใช้" ตรงไปตรงมา ไม่มีข้อความสำเร็จ', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ ok: false, error: 'not_implemented' }), { status: 501 }))
    render(<CookiesProvider><DeleteAccountPage /></CookiesProvider>)
    fireEvent.click(screen.getByTestId('delete-confirm-check'))
    fireEvent.click(screen.getByTestId('delete-submit'))
    await waitFor(() => expect(screen.getByTestId('delete-not-implemented')).toBeTruthy())
    expect(fetchMock).toHaveBeenCalledWith('/api/v2/account/delete', { method: 'POST' })
    expect(screen.queryByText(/ลบสำเร็จ|ยกเลิกบัญชีแล้ว/i)).toBeNull()
  })

  it('D2b network error → โชว์สถานะ error ให้ลองใหม่', async () => {
    fetchMock.mockRejectedValue(new Error('offline'))
    render(<CookiesProvider><DeleteAccountPage /></CookiesProvider>)
    fireEvent.click(screen.getByTestId('delete-confirm-check'))
    fireEvent.click(screen.getByTestId('delete-submit'))
    await waitFor(() => expect(screen.getByTestId('delete-errored')).toBeTruthy())
  })
})
