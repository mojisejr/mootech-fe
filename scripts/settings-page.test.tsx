// scripts/settings-page.test.tsx — หน้า /v2/settings (จุดหมายของปุ่ม ⚙ บนหน้าแชท — team 2026-09-03)
//
// 🔴 MUTANT CONTRACT:
//   S1 แถวครบ: โปรไฟล์ / สิทธิ์ของฉัน / PDPA / ลบบัญชี            → "rows ครบ" แดง
//   S2 ออกจากระบบต้องยืนยันก่อน (กดครั้งเดียว ❌ ไม่หลุด)          → "logout กันพลาด" แดง
//   S3 กดยืนยัน → เรียก logout จริง                              → "logout ทำงาน" แดง
import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'
import { CookiesProvider } from 'react-cookie'

const logoutMock = vi.hoisted(() => vi.fn())
vi.mock('next/config', () => ({ default: () => ({ publicRuntimeConfig: {}, serverRuntimeConfig: {} }) }))
vi.mock('next/router', () => ({
  useRouter: () => ({ push: vi.fn(), query: {}, pathname: '/v2/settings', isReady: true }),
}))
vi.mock('next-auth/react', () => ({ useSession: () => ({ data: null, status: 'unauthenticated' }) }))

vi.mock('@/features/auth/hooks/useV2Logout', () => ({
  useV2Logout: () => ({ logout: logoutMock }),
}))
vi.mock('@/features/auth/hooks/useV2Tier', () => ({
  useV2Tier: () => ({ isPaid: false, tier: 'FREE', loading: false }),
}))

import V2SettingsPage from '@/pages/v2/settings/index'

describe('#team-mp4 · หน้าตั้งค่า', () => {
  beforeEach(() => { logoutMock.mockReset() })
  afterEach(() => cleanup())

  it('S1 แถวครบ: โปรไฟล์ / สิทธิ์ของฉัน / PDPA / ลบบัญชี', () => {
    render(<CookiesProvider><V2SettingsPage /></CookiesProvider>)
    expect(screen.getByTestId('settings-profile')).toBeTruthy()
    expect(screen.getByTestId('settings-membership')).toBeTruthy()
    expect(screen.getByTestId('settings-privacy-policy')).toBeTruthy()
    expect(screen.getByTestId('settings-delete-account')).toBeTruthy()
  })

  it('S2 ออกจากระบบต้องยืนยันก่อน — กดครั้งเดียว ❌ ไม่หลุดทันที', () => {
    render(<CookiesProvider><V2SettingsPage /></CookiesProvider>)
    fireEvent.click(screen.getByTestId('settings-logout-ask'))
    // กดยืนยันเป็นขั้นที่สอง — ตรวจว่าตัวยืนยันโผล่จริง
    expect(screen.getByTestId('settings-logout-confirm')).toBeTruthy()
    expect(logoutMock).not.toHaveBeenCalled()
  })

  it('S3 กดยืนยัน → logout ถูกเรียก', async () => {
    render(<CookiesProvider><V2SettingsPage /></CookiesProvider>)
    fireEvent.click(screen.getByTestId('settings-logout-ask'))
    fireEvent.click(screen.getByTestId('settings-logout-confirm'))
    await waitFor(() => expect(logoutMock).toHaveBeenCalled())
  })
})
