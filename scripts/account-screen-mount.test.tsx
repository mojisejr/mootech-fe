// scripts/account-screen-mount.test.tsx — จอโปรไฟล์ (แดชบอร์ด เฟรม profile-and-qi-wallet) ประกอบจริง
//
// 🔴 ฟันความจริงของ "แหล่งข้อมูลใหม่": กระเป๋าชี่ engine ล้ม → ซ่อน hero ❌ โชว์ 0 เป็นเรื่องจริง
//   + แผนยังอ่านจาก useV2User + ทางเข้าตั้งค่า/ประวัติถูกต้อง
import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, waitFor } from '@testing-library/react'
import { CookiesProvider } from 'react-cookie'

vi.mock('next/config', () => ({ default: () => ({ publicRuntimeConfig: {}, serverRuntimeConfig: {} }) }))
vi.mock('next/router', () => ({
  useRouter: () => ({ pathname: '/v2/account', asPath: '/v2/account', route: '/v2/account', query: {}, isReady: true, push: vi.fn(), replace: vi.fn(), prefetch: vi.fn(() => Promise.resolve()), events: { on: vi.fn(), off: vi.fn(), emit: vi.fn() } }),
}))
vi.mock('@/features/auth/hooks/useV2User', () => ({
  useV2User: () => ({
    userId: 'u-365', done: true, errored: false,
    user: { user_id: 'u-365', membership: { isPaid: true, tier: 'PRO', source: 'v2', expireAt: '2027-07-14' } },
  }),
}))

import { AccountScreen } from '@/features/v2-account/components/AccountScreen'

function stubAll({ walletOk = true, qi = 0, history = [] as unknown[] } = {}) {
  vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => {
    const url = String(input)
    if (url.includes('/api/qi-wallet')) {
      return Promise.resolve((walletOk
        ? { ok: true, json: async () => ({ qi, coins: 0, xp: 0, level: 1, history }) }
        : { ok: false, status: 500, json: async () => ({}) }) as Response)
    }
    if (url.includes('/api/profile')) return Promise.resolve({ ok: true, json: async () => ({ profile: null }) } as Response)
    if (url.includes('/api/missions')) return Promise.resolve({ ok: true, json: async () => ({ missions: [], goals: null }) } as Response)
    if (url.includes('/api/referral')) return Promise.resolve({ ok: true, json: async () => ({ invitedCount: 0 }) } as Response)
    if (url.includes('/api/v2/account/delete')) return Promise.resolve({ ok: true, json: async () => ({ deletion: null }) } as Response)
    return Promise.resolve({ ok: true, json: async () => ({}) } as Response)
  }))
}

document.cookie = 'cookie-mumate-id=11111111-1111-1111-1111-111111111111'
const mount = () => render(<CookiesProvider>{React.createElement(AccountScreen)}</CookiesProvider>)

beforeEach(() => vi.clearAllMocks())
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

describe('จอโปรไฟล์ (แดชบอร์ด) ประกอบจริง', () => {
  it('การ์ด QI: engine ตอบ 500 → ซ่อนการ์ด ❌ ไม่โชว์ 0 เป็นเรื่องจริง + จอที่เหลือยังยืน', async () => {
    stubAll({ walletOk: false })
    mount()
    await waitFor(() => expect(screen.getByTestId('account-header')).toBeTruthy())
    await waitFor(() => expect(screen.queryByTestId('account-qi-wallet')).toBeNull())
  })

  it('engine ตอบสำเร็จ → การ์ด QI โชว์ยอดจริง + ทางเข้าประวัติ/ตั้งค่าถูกต้อง', async () => {
    stubAll({ walletOk: true, qi: 630 })
    const { container } = mount()
    await waitFor(() => expect(screen.getByTestId('account-qi-balance').textContent).toContain('630'))
    expect(container.textContent).toContain('ยอดคงเหลือ')
    expect(screen.getByTestId('account-qi-history').getAttribute('href')).toBe('/v2/qi/history')
    expect(screen.getByTestId('qi-topup-link').getAttribute('href')).toBe('/v2/qi/buy')
    expect(screen.getByTestId('account-settings-link').getAttribute('href')).toBe('/v2/settings')
  })

  it('แผนยังอ่านจาก useV2User — PRO + วันหมดอายุโชว์ครบ', async () => {
    stubAll({ walletOk: true, qi: 0 })
    const { container } = mount()
    await waitFor(() => expect(screen.getByTestId('account-plan-name').textContent).toBe('Mumate Pro'))
    expect(container.textContent).toContain('ใช้ได้ถึง 14 ก.ค. 2570')
  })
})
