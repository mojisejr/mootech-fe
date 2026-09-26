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

// 🔴 MUTANT CONTRACT (mumate-login-identity-001 slice 3):
//   S4 แถว "บัญชีที่เชื่อมต่อ" ต้องพูดจาก /api/auth/link/connections ไม่ใช่คำตายตัว
//      → คืนโค้ดเดิม `profile?.displayName ? '@…' : 'LINE'` แล้ว S4 แดงทันที
//   S6 ยังไม่รู้ = ไม่โชว์ค่า — กฎเดียวกับแถว "แพ็กเกจของฉัน" ที่เคย hardcode "Free Tier"
describe('#mumate-login-identity · แถวบัญชีที่เชื่อมต่อพูดจากข้อมูลจริง', () => {
  afterEach(() => { vi.unstubAllGlobals(); cleanup() })

  const stubConnections = (connections: unknown) =>
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: unknown) =>
        String(url).includes('/api/auth/link/connections')
          ? { ok: true, json: async () => ({ ok: true, connections }) }
          : { ok: false, json: async () => ({}) },
      ),
    )

  it('S4 เชื่อมแค่ Google → บอก Google และไม่โผล่คำว่า LINE', async () => {
    stubConnections([
      { provider: 'google', linked: true, current: true, canUnlink: false },
      { provider: 'line', linked: false, current: false, canUnlink: false },
    ])
    render(<CookiesProvider><V2SettingsPage /></CookiesProvider>)
    await waitFor(() => expect(screen.getByTestId('settings-connected').textContent).toContain('Google'))
    expect(screen.getByTestId('settings-connected').textContent).not.toContain('LINE')
  })

  it('S5 เชื่อมทั้งสอง → บอกทั้งสอง ไม่ใช่แค่ตัวที่ล็อกอินอยู่', async () => {
    stubConnections([
      { provider: 'google', linked: true, current: true, canUnlink: true },
      { provider: 'line', linked: true, current: false, canUnlink: true },
    ])
    render(<CookiesProvider><V2SettingsPage /></CookiesProvider>)
    await waitFor(() => expect(screen.getByTestId('settings-connected').textContent).toContain('Google'))
    expect(screen.getByTestId('settings-connected').textContent).toContain('LINE')
  })

  it('S6 อ่านสถานะไม่ได้ → ไม่โชว์ค่าเลย (ไม่เดา)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, json: async () => ({}) })))
    render(<CookiesProvider><V2SettingsPage /></CookiesProvider>)
    // ไม่มีค่า → Row วาดลูกศร › แทน
    await waitFor(() => expect(screen.getByTestId('settings-connected').textContent).toContain('›'))
    expect(screen.getByTestId('settings-connected').textContent).not.toContain('LINE')
  })
})
