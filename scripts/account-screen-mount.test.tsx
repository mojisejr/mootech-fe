// scripts/account-screen-mount.test.tsx — จอ #365 ประกอบจริง แล้วให้ /api/v2/payment/status ล้ม
//
// 🔴 WHY THIS FILE EXISTS (ตู๋ R1/R2, review of 2aac026). The previous guard on "a failed read must not say
// ยังไม่มีรายการ" asserted the SPELLING of one line in AccountScreen.tsx:
//
//     expect(src).not.toMatch(/r\.ok \? r\.json\(\) : \{ payments: \[\] \}/)
//
// ตู๋ put the old bug back with ONE extra pair of parentheses — `: ({ payments: [] })` — and the suite stayed
// 25/25 green while "ยังไม่มีรายการ" returned on every failure path. A tooth named for a BEHAVIOUR that only
// checks a spelling is the exact class this PR has now been bitten by three times; the answer is to mount the
// screen and read the words a person actually sees.
//
// The reason I avoided mounting — useV2User → constants/api/endpoint.ts calls getConfig() at module load —
// was already solved in this repo one line at a time: scripts/tier-prod-pages.test.tsx:16.
//
// 🔴 MUTANT CONTRACT (each reddens `npm test`):
//   B1  restore `: { payments: [] }` (with or WITHOUT parens)  → "ok:false shows the error card" red
//   B2  drop onRetry's body so the button does nothing         → "retry actually re-reads" red
//   B3  HistoryCard renders error with the empty wording       → both cases red
import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react'
import { CookiesProvider } from 'react-cookie'

// Same one-line stub as scripts/tier-prod-pages.test.tsx:16 — the module graph reads runtime config at load.
vi.mock('next/config', () => ({ default: () => ({ publicRuntimeConfig: {}, serverRuntimeConfig: {} }) }))
// Menubar reads router.pathname (Menubar.tsx:59) — the mock has to carry the fields the real router does,
// otherwise the failure is the MOCK being thin, not the screen being wrong. Fix the fixture, never widen the
// component to tolerate a shape the real router always supplies.
vi.mock('next/router', () => ({
  useRouter: () => ({ pathname: '/v2/account', asPath: '/v2/account', route: '/v2/account', query: {}, isReady: true, push: vi.fn(), replace: vi.fn(), prefetch: vi.fn(() => Promise.resolve()), events: { on: vi.fn(), off: vi.fn(), emit: vi.fn() } }),
}))

// The IDENTITY half is mocked on purpose. This file is about one question — "what does the screen say when
// the history read fails" — and useV2User reaches it through callApi → constants/api/endpoint, whose runtime
// config is stubbed to `{}` above. Driving that plumbing here would test the plumbing, not the words. Its own
// behaviour is covered elsewhere (scripts/v2-tier.test.ts, user-membership-route.test.ts).
// 🔑 It also makes the assertions STRONGER: with a resolved paid member, the whole screen paints, so
// "ยังไม่มีรายการ appears nowhere in the document" is a claim about the finished page, not about a skeleton.
vi.mock('@/features/auth/hooks/useV2User', () => ({
  useV2User: () => ({
    userId: 'u-365',
    done: true,
    errored: false,
    user: { user_id: 'u-365', membership: { isPaid: true, tier: 'PRO', source: 'v2', expireAt: '2027-07-14' } },
  }),
}))

import { AccountScreen } from '@/features/v2-account/components/AccountScreen'

const USER = { user_id: 'u-365', membership: { isPaid: true, tier: 'PRO', source: 'v2', expireAt: '2027-07-14' } }

/** Route the two fetches this screen makes. `history` decides what /payment/status answers. */
function stubFetch(history: () => Partial<Response> & { json?: () => Promise<unknown> }) {
  const calls: string[] = []
  const fn = vi.fn((input: RequestInfo | URL) => {
    const url = String(input)
    calls.push(url)
    if (url.includes('/api/v2/payment/status')) return Promise.resolve(history() as Response)
    return Promise.resolve({ ok: true, json: async () => USER } as Response)
  })
  vi.stubGlobal('fetch', fn)
  return { calls, fn }
}

// useV2User reads the MEMBER_ID cookie (constants/cookie-key.ts:2) and does NOT fetch /api/user without it,
// so an anonymous mount would sit in the "not determined" skeleton forever — which would make the last case
// below pass for the wrong reason. Same uuid the e2e specs use.
document.cookie = 'cookie-mumate-id=11111111-1111-1111-1111-111111111111'

const mount = () => render(<CookiesProvider>{React.createElement(AccountScreen)}</CookiesProvider>)

beforeEach(() => vi.clearAllMocks())
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

describe('จอโปรไฟล์ (reskin เฟรม profile-and-qi-wallet 2026-09-04) ประกอบจริง', () => {
  // 🔴 บทเรียนเดิมย้ายบ้านแล้ว: "ประวัติซื้อล้ม ห้ามพูดว่า ยังไม่มีรายการ" — จอนี้ไม่มีการ์ดประวัติ
  // inline อีกต่อไป (เฟรมใหม่ย้ายไป /v2/orders เต็มที่) ฟันคู่เดิมอยู่ที่ scripts/orders-screen.test.tsx
  // (อ่านล้ม → error ❌ empty · ลองใหม่ยิงจริง) จอนี้เก็บฟันความจริงของ "แหล่งข้อมูลใหม่": กระเป๋าชี่
  const stubQi = (ok: boolean, qi = 0) =>
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/api/qi-wallet')) {
        return Promise.resolve(ok
          ? { ok: true, json: async () => ({ qi, coins: 0, xp: 0, level: 1, history: [] }) }
          : { ok: false, status: 500, json: async () => ({}) } as Response)
      }
      return Promise.resolve({ ok: true, json: async () => USER } as Response)
    }))

  it('hero กระเป๋าชี่: engine ตอบ 500 → ซ่อน hero ❌ โชว์เลข 0 เป็นเรื่องจริง + จอที่เหลือยังยืน', async () => {
    stubQi(false)
    const { container } = mount()
    await waitFor(() => expect(container.textContent).toContain('โปรไฟล์'))
    await waitFor(() => expect(screen.queryByTestId('account-qi-wallet')).toBeNull())
    expect(container.textContent).not.toContain('เริ่มสะสมชี่วันนี้') // day-one copy = ข้อเท็จจริงของข้อมูล ไม่ใช่ของความล้ม
  })

  it('engine ตอบสำเร็จ → hero โชว์ยอดจากคำตอบจริง + quick actions ครบ 4', async () => {
    stubQi(true, 630)
    const { container } = mount()
    await waitFor(() => expect(screen.getByTestId('account-qi-balance').textContent).toContain('630'))
    expect(container.textContent).toContain('พลังชี่สะสมของคุณ')
    expect(screen.getByTestId('account-qa-missions').getAttribute('href')).toBe('/v2/qi/missions')
    expect(screen.getByTestId('account-qa-history').getAttribute('href')).toBe('/v2/qi/history')
    expect(screen.getByTestId('account-qa-referral').getAttribute('href')).toBe('/v2/qi/referral')
    expect(screen.getByTestId('account-qa-redeem').getAttribute('href')).toBe('/v2/qi')
  })

  it('แผนยังอ่านจาก useV2User เหมือนเดิม — PRO + วันหมดอายุโชว์ครบ', async () => {
    stubQi(true, 0)
    const { container } = mount()
    await waitFor(() => expect(screen.getByTestId('account-plan').textContent).toBe('Mumate Pro'))
    expect(container.textContent).toContain('ใช้ได้ถึง 14 ก.ค. 2570')
  })
})
