// #264 — the UI half. goo's scripts/usage-core.test.ts + quota-route.test.tsx guard the NUMBERS (windows,
// ceilings, clamping); this file guards what a person actually sees, and above all what they see when we
// DON'T have a number.
//
// `fetch` is stubbed rather than the hook, so useQuota's real wire→view mapping runs inside the real
// screen. A test that mocked useQuota would assert my own literal back to me and would stay green if the
// mapping collapsed 'unavailable' into a zero — which is the one failure this feature must not have.
//
// .tsx so ci.yml's legacy `for f in scripts/*.test.ts` lane never sees it (that lane runs plain
// node:assert scripts under tsx). Registered in vitest.config.mts `include` — APPENDED, never replacing
// (that list carries its own "UNION, never pick a side" warning; #214 and #218 ate each other there once).
//
// MUTANT CONTRACT — each flips real behaviour, each goes RED here:
//   U1  useQuota catch → { remaining: 0 } instead of 'unavailable'   → "อ่านไม่ได้ต้องไม่โชว์เลข" RED
//   U2  QuotaLine renders on 'loading' too                            → "ยังไม่รู้ต้องไม่โชว์" RED
//   U3  QuotaLine low colour → text-v3-error                          → "เหลือน้อยไม่ใช่ error" RED
//   U4  LOW_REMAINING 5 → 0 (never switches tone)                     → "เหลือน้อยเปลี่ยนโทน" RED
//   U5  copy → `เหลือ N ครั้งในปีนี้`                                   → "ห้ามมีเส้นตายในบรรทัด" RED
//   U6  indicator rendered even when calcError==='quota'              → "0 ครั้ง ไม่ซ้อนกับ ครบแล้ว" RED
//   U7  'unlimited' renders a number                                  → "สมาชิกไม่เห็นตัวเลข" RED
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'

const { push, calculateCompatibility, useCompatibility } = vi.hoisted(() => ({
  push: vi.fn(),
  calculateCompatibility: vi.fn(),
  useCompatibility: vi.fn(),
}))

vi.mock('next/config', () => ({ default: () => ({ publicRuntimeConfig: {}, serverRuntimeConfig: {} }) }))
vi.mock('next/router', () => ({ useRouter: () => ({ push, query: {}, pathname: '/v2/service/compatibility' }) }))
vi.mock('@/features/v2-service/hooks/useCompatibilityResult', () => ({ calculateCompatibility }))
vi.mock('@/features/v2-service/hooks/useCompatibility', () => ({ useCompatibility: () => useCompatibility() }))
vi.mock('@/features/auth/hooks/useV2Logout', () => ({ useV2Logout: () => ({ logout: vi.fn() }) }))
vi.mock('@/features/v2-shell/components/Menubar', () => ({ Menubar: () => null }))
vi.mock('@/features/v2-shell/components/TopBarBell', () => ({ TopBarBell: () => null }))
vi.mock('@/features/v2-shell/components/TopBarAvatar', () => ({ TopBarAvatar: () => null }))
vi.mock('@/features/v2-shell/components/LoadingScreen', () => ({ LoadingScreen: () => <div data-testid="loading" /> }))
// The screen reads MEMBER_ID from the cookie to know whom to ask about.
vi.mock('react-cookie', () => ({ useCookies: () => [{ 'cookie-mumate-id': 'u-1' }] }))

import { CompatibilityScreen } from '@/features/v2-service/components/CompatibilityScreen'

const PERSON1 = { id: 'u-1', name: 'ฟีม', dob: '1990-01-01', time: '08:00', gender: 'MALE' }
const PERSON2 = { id: 'f-1', name: 'เพื่อน', dob: '1992-02-02', time: '09:00', gender: 'FEMALE' }
const CONFIG = { matchingType: 'LOVE', title: 'เช็คความสมพงศ์', tagline: 'ด้านความรัก' } as never

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  vi.unstubAllGlobals()
})

/** Stub GET /api/quota with a wire body, or make the read fail outright. */
function stubQuota(body: unknown | 'fail' | 'never') {
  vi.stubGlobal('fetch', vi.fn(() => {
    if (body === 'fail') return Promise.resolve({ ok: false, status: 500, json: async () => ({}) })
    if (body === 'never') return new Promise(() => {}) // stays in flight → the 'loading' state
    return Promise.resolve({ ok: true, status: 200, json: async () => body })
  }))
}

function renderScreen(opts: { noFriendPicked?: boolean } = {}) {
  // With no friend picked, row 2 is the empty "+" button that OPENS the select modal — that is the real
  // route to adding a friend, and the only way to reach the second indicator.
  useCompatibility.mockReturnValue({
    person1: PERSON1,
    person2: opts.noFriendPicked ? null : PERSON2,
    matchingType: 'LOVE',
    canViewResult: !opts.noFriendPicked,
    loadingPerson2: false, selectFriend: vi.fn(), createFriend: vi.fn(),
  })
  render(<CompatibilityScreen config={CONFIG} />)
}

const FREE = (remaining: number) => ({
  matching: { unlimited: false, limit: 100, used: 100 - remaining, remaining },
  friend: { unlimited: false, limit: 20, used: 3, remaining: 17 },
})

const line = () => screen.queryByTestId('compat-quota-matching')

describe('#264 quota indicator — ตัวเลขที่ช่วยตัดสินใจ ไม่ใช่ตัวเร่ง', () => {
  it('รู้จำนวนจริง → เห็นว่าเหลือกี่ครั้ง', async () => {
    stubQuota(FREE(97))
    renderScreen()
    await waitFor(() => expect(line()).toBeTruthy())
    expect(line()!.textContent).toBe('เหลือ 97 ครั้ง')
  })

  it('🔴 อ่านโควตาไม่ได้ → ไม่โชว์ตัวเลขใดๆ (ห้ามกลายเป็น 0)', async () => {
    // The failure this whole union exists for: telling someone who HAS quota that they have none is a
    // wrong reason, which is worse than #263's no-reason.
    stubQuota('fail')
    renderScreen()
    await waitFor(() => expect((global.fetch as ReturnType<typeof vi.fn>).mock.calls.length).toBe(1))
    expect(line()).toBeNull()
    expect(document.body.textContent).not.toContain('เหลือ 0')
    expect(document.body.textContent).not.toMatch(/เหลือ\s*\d/)
  })

  it('🔴 ยังโหลดไม่เสร็จ → ไม่โชว์ตัวเลข', async () => {
    stubQuota('never')
    renderScreen()
    expect(line()).toBeNull()
    expect(document.body.textContent).not.toMatch(/เหลือ\s*\d/)
  })

  it('🔴 สมาชิก (ไม่จำกัด) → ไม่เห็นตัวเลข', async () => {
    stubQuota({ matching: { unlimited: true, used: 42 }, friend: { unlimited: false, limit: 20, used: 3, remaining: 17 } })
    renderScreen()
    await waitFor(() => expect((global.fetch as ReturnType<typeof vi.fn>).mock.calls.length).toBe(1))
    expect(line()).toBeNull()
    expect(document.body.textContent).not.toContain('42')
  })

  it('เหลือน้อย (≤5) เปลี่ยนโทนเป็น navy — แต่ไม่ใช่สีของ error', async () => {
    stubQuota(FREE(3))
    renderScreen()
    await waitFor(() => expect(line()).toBeTruthy())
    expect(line()!.className).toContain('text-v3-navy')
    expect(line()!.className).not.toContain('text-v3-error')
  })

  it('เหลือเยอะ = เงียบ (muted) — ต้องต่างจากตอนเหลือน้อยจริง', async () => {
    // negative control: without this, the low-tone case would also pass if EVERY count were navy.
    stubQuota(FREE(97))
    renderScreen()
    await waitFor(() => expect(line()).toBeTruthy())
    expect(line()!.className).toContain('text-v3-text-muted')
    expect(line()!.className).not.toContain('text-v3-navy')
  })

  it('🔴 ข้อห้ามของบอง เป็นเงื่อนไขที่ตรวจได้: ไม่มีมาตรวัด ไม่มีเส้นตาย ไม่มีสีเตือน', async () => {
    for (const remaining of [97, 20, 5, 1]) {
      stubQuota(FREE(remaining))
      renderScreen()
      await waitFor(() => expect(line()).toBeTruthy())
      const el = line()!
      expect(el.textContent).not.toContain('%')
      expect(el.textContent).not.toContain('ปี') // no expiry framing on an unspent allowance
      expect(el.className).not.toContain('text-v3-error')
      expect(el.querySelector('progress,[role="progressbar"]')).toBeNull()
      cleanup()
      vi.clearAllMocks()
    }
  })

  it('🔴 เหลือ 0 + ข้อความ "ใช้สิทธิ์ครบแล้ว" ของ #263 → ไม่พูดซ้ำสองบรรทัด', async () => {
    stubQuota(FREE(0))
    calculateCompatibility.mockResolvedValue({ ok: false, reason: 'quota' })
    renderScreen()
    await waitFor(() => expect(line()).toBeTruthy())
    screen.getByTestId('compat-view-result').click()
    await waitFor(() => expect(screen.getByTestId('compat-result-error')).toBeTruthy())
    expect(screen.getByTestId('compat-result-error').textContent).toContain('ใช้สิทธิ์ดูดวงสมพงศ์ครบแล้ว')
    expect(line()).toBeNull()
  })

  it('พังด้วยเหตุอื่น (5xx) → indicator ยังอยู่ เพราะจำนวนไม่ได้เปลี่ยน', async () => {
    stubQuota(FREE(12))
    calculateCompatibility.mockResolvedValue({ ok: false, reason: 'system' })
    renderScreen()
    await waitFor(() => expect(line()).toBeTruthy())
    screen.getByTestId('compat-view-result').click()
    await waitFor(() => expect(screen.getByTestId('compat-result-error')).toBeTruthy())
    expect(line()!.textContent).toBe('เหลือ 12 ครั้ง')
  })

  it('โควตาเพื่อนโชว์ในที่ที่กดเพิ่มเพื่อน และนับคนละหน่วย', async () => {
    stubQuota(FREE(97))
    renderScreen({ noFriendPicked: true })
    await waitFor(() => expect(line()).toBeTruthy())
    screen.getByTestId('compat-person2').click()
    await waitFor(() => expect(screen.getByTestId('compat-select-modal')).toBeTruthy())
    expect(screen.getByTestId('compat-quota-friend').textContent).toBe('เพิ่มได้อีก 17 คน')
  })

  it('ทั้งสองตัวเลขมาจากการอ่านครั้งเดียว — ไม่ยิงซ้ำจนเถียงกันเองได้', async () => {
    stubQuota(FREE(97))
    renderScreen({ noFriendPicked: true })
    await waitFor(() => expect(line()).toBeTruthy())
    screen.getByTestId('compat-person2').click()
    await waitFor(() => expect(screen.getByTestId('compat-quota-friend')).toBeTruthy())
    expect((global.fetch as ReturnType<typeof vi.fn>).mock.calls.length).toBe(1)
  })
})
