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

function stubAll({ walletOk = true, qi = 0, history = [] as unknown[], invitedCount = 0, goals = null as unknown, pack = null as unknown, friends = null as unknown, friendsOk = true } = {}) {
  vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => {
    const url = String(input)
    if (url.includes('/api/qi-wallet')) {
      return Promise.resolve((walletOk
        ? { ok: true, json: async () => ({ qi, coins: 0, xp: 0, level: 1, history }) }
        : { ok: false, status: 500, json: async () => ({}) }) as Response)
    }
    if (url.includes('/api/profile')) return Promise.resolve({ ok: true, json: async () => ({ profile: null }) } as Response)
    if (url.includes('/api/missions')) return Promise.resolve({ ok: true, json: async () => ({ missions: [], goals }) } as Response)
    if (url.includes('/api/referral')) return Promise.resolve({ ok: true, json: async () => ({ invitedCount }) } as Response)
    if (url.includes('/api/member-with-friend')) {
      // GET /api/member-with-friend ตอบ array เปล่า ๆ (รายชื่อเพื่อนที่บันทึกวันเกิดไว้)
      return Promise.resolve((friendsOk ? { ok: true, json: async () => friends } : { ok: false, status: 500, json: async () => ({}) }) as Response)
    }
    if (url.includes('/api/payment-package')) return Promise.resolve(pack ? { ok: true, json: async () => pack } as Response : { ok: false, status: 404, json: async () => ({}) } as Response)
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

  // 2026-09-07 Figma parity (55399:5007) — แถวเพื่อน: avatar stack 34px + วง "+N" + badge เก็บแล้ว/5 + copy ตามเฟรม
  // ประชุม 24 พ.ย. ข้อ 3: การ์ดนับจากรายชื่อที่บันทึกไว้ (ตรงกับหน้า /v2/friends) และพาไปหน้านั้น
  const GOALS = { referral: { invited: 80 }, element: { collected: 3, elements: [
    { key: 'wood', collected: true }, { key: 'water', collected: true }, { key: 'earth', collected: true }, { key: 'fire', collected: false }, { key: 'metal', collected: false } ] } }
  const friend = (id: string, name: string) => ({ id, name, surname: '', picture_url: null, dob: '1995-06-15', time: '09:30', is_remember_time: true, is_member: false, member_id: '', is_disable: false })
  const stackText = () => Array.from(screen.getByTestId('account-friends-stack').children).map((c) => c.textContent)

  it('แถวเพื่อน: นับจากรายชื่อ 5 คน (ไม่ใช่ชวนมา 80) → 3 วงอักษรแรกของชื่อจริง + "+2" · badge 3/5 · "ยังขาดไฟและทอง" · พาไป /v2/friends', async () => {
    stubAll({ invitedCount: 80, goals: GOALS, friends: [friend('f1', 'สมศรี'), friend('f2', 'มานพ'), friend('f3', 'วิไล'), friend('f4', 'ประยุทธ์'), friend('f5', 'เอก')] })
    mount()
    await waitFor(() => expect(screen.getByTestId('account-friends-badge').textContent).toBe('3/5'))
    expect(stackText()).toEqual(['ส', 'ม', 'ว', '+2'])
    expect(screen.getByTestId('account-friends').textContent).toContain('เพื่อนของคุณ 5 คน')
    expect(screen.getByTestId('account-friends').getAttribute('href')).toBe('/v2/friends')
    expect(screen.getByTestId('account-friends').textContent).toContain('เก็บครบ 5 ธาตุรับ 1,000 QI · ยังขาดไฟและทอง')
  })

  it('รายชื่อโหลดไม่ได้ → ถอยไปนับจำนวนชวนมาแบบเดิม (8 คน · วง "ธ") ❌ ไม่วาดสถานะว่างทับความล้มเหลว', async () => {
    stubAll({ invitedCount: 8, goals: GOALS, friendsOk: false })
    mount()
    await waitFor(() => expect(screen.getByTestId('account-friends-badge').textContent).toBe('3/5'))
    expect(stackText()).toEqual(['ธ', 'ธ', 'ธ', '+5'])
    expect(screen.getByTestId('account-friends').textContent).toContain('เพื่อนของคุณ 8 คน')
    expect(screen.getByTestId('account-friends').textContent).not.toContain('ชวนเพื่อนคนแรก')
  })

  it('รายชื่อว่าง แต่ชวนมา 4 คน → "เพื่อนที่ชวนมา 4 คน" ❌ ไม่พูดว่า "ชวนเพื่อนคนแรก"', async () => {
    stubAll({ invitedCount: 4, goals: GOALS, friends: [] })
    mount()
    await waitFor(() => expect(screen.getByTestId('account-friends').textContent).toContain('เพื่อนที่ชวนมา 4 คน'))
    expect(screen.getByTestId('account-friends').textContent).not.toContain('ชวนเพื่อนคนแรก')
    expect(stackText()).toEqual(['ธ', 'ธ', 'ธ', '+1'])
  })

  it('ไม่มีเพื่อนทั้งสองกลุ่ม → สถานะว่าง ไม่มี stack/badge', async () => {
    stubAll({ invitedCount: 0, goals: GOALS, friends: [] })
    mount()
    await waitFor(() => expect(screen.getByTestId('account-friends').textContent).toContain('สะสมเพื่อนให้ครบ 5 ธาตุ'))
    expect(screen.queryByTestId('account-friends-stack')).toBeNull()
    expect(screen.queryByTestId('account-friends-badge')).toBeNull()
  })
})

// แถว Pro (55399:5020) ต้องใช้ผู้ใช้ FREE — mock useV2User ข้างบนเป็น PRO จึงแยกไฟล์ไม่ได้ ใช้ doMock+re-import แทน
describe('แถว Mumate Pro ประหยัด ฿ (ผู้ใช้ฟรี)', () => {
  const month = new Date().toISOString().slice(0, 7)
  const spend = (qi: number) => ({ id: `s${qi}`, reason: 'qi:spend:chat_question', qiDelta: -qi, createdAt: `${month}-03T05:00:00.000Z` })
  async function mountFree(opts: Parameters<typeof stubAll>[0]) {
    vi.resetModules()
    vi.doMock('@/features/auth/hooks/useV2User', () => ({
      useV2User: () => ({ userId: 'u-free', done: true, errored: false, user: { user_id: 'u-free', membership: { isPaid: false, tier: 'FREE', source: 'v2', expireAt: null } } }),
    }))
    const { AccountScreen: Free } = await import('@/features/v2-account/components/AccountScreen')
    stubAll(opts)
    render(<CookiesProvider>{React.createElement(Free)}</CookiesProvider>)
  }
  it('จ่าย 360 QI ที่ ฿0.5889/QI (QI_60 = ฿53 / 90 QI) → "เดือนนี้จ่ายค่า QI ไป ฿212" · "ประหยัด ฿13" · badge แนะนำ → ร้านค้า', async () => {
    await mountFree({ history: [spend(200), spend(160), { id: 'e', reason: 'qi:earn:daily_login', qiDelta: 5, createdAt: `${month}-03T05:00:00.000Z` }], pack: { amount: 53, is_active: true } })
    await waitFor(() => expect(screen.getByTestId('account-plan-name').textContent).toBe('เดือนนี้จ่ายค่า QI ไป ฿212'))
    expect(screen.getByTestId('account-plan-sub').textContent).toBe('Mumate Pro ฿199/เดือน หรือ Mumate+ ฿790/ปี ใช้ไม่จำกัด ประหยัด ฿13')
    expect(screen.getByTestId('account-shop-cta').textContent).toBe('แนะนำ')
    expect(screen.getByTestId('account-plan').getAttribute('href')).toBe('/v2/shop')
  })
  it('ไม่รู้ราคาแพ็ก / ไม่มีรายจ่าย → ไม่แต่งตัวเลข: ชื่อแผน + "Pro ฿199 ใช้ไม่จำกัด" เฉย ๆ', async () => {
    await mountFree({ history: [spend(200)], pack: null })
    await waitFor(() => expect(screen.getByTestId('account-plan-name').textContent).toBe('Mumate Free'))
    expect(screen.getByTestId('account-plan-sub').textContent).toBe('Mumate Pro ฿199/เดือน หรือ Mumate+ ฿790/ปี ใช้ไม่จำกัด')
  })
})
