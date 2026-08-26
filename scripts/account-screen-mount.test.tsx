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

describe('#365 จอประกอบจริง · ประวัติโหลดไม่สำเร็จ (ตู๋ R2 · 2aac026)', () => {
  // 🔴 B1 — the words a person reads, not the characters in the source file.
  it('🔴 B1 status ตอบ 500 → เห็นการ์ด error และ ❌ ไม่มีคำว่า "ยังไม่มีรายการ" ที่ไหนเลยบนจอ', async () => {
    stubFetch(() => ({ ok: false, status: 500, json: async () => ({ payments: [] }) }))
    const { container } = mount()

    await waitFor(() => expect(screen.getByTestId('account-history-error')).toBeTruthy())
    expect(screen.queryByTestId('account-history-empty')).toBeNull()
    // the whole document, not just the card — this is the sentence that must not exist anywhere
    expect(container.textContent).not.toContain('ยังไม่มีรายการ')
    expect(container.textContent).toContain('โหลดประวัติการซื้อไม่สำเร็จ')
  })

  it('401 ก็ต้องเป็น error เหมือนกัน (ไม่ใช่แค่ 500) — ทุกทางที่ไม่ ok คือความล้มของเรา', async () => {
    stubFetch(() => ({ ok: false, status: 401, json: async () => ({ payments: [] }) }))
    const { container } = mount()
    await waitFor(() => expect(screen.getByTestId('account-history-error')).toBeTruthy())
    expect(container.textContent).not.toContain('ยังไม่มีรายการ')
  })

  it('fetch โยน exception ก็ต้องเป็น error ไม่ใช่ empty', async () => {
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) =>
      String(input).includes('/payment/status')
        ? Promise.reject(new Error('network'))
        : Promise.resolve({ ok: true, json: async () => USER } as Response)))
    const { container } = mount()
    await waitFor(() => expect(screen.getByTestId('account-history-error')).toBeTruthy())
    expect(container.textContent).not.toContain('ยังไม่มีรายการ')
  })

  // 🔴 B2 — ตู๋ R1: the old guard only proved the BUTTON EXISTED. An empty handler passed it.
  it('🔴 B2 กด "ลองอีกครั้ง" แล้วต้องยิง /payment/status ใหม่จริง (ปุ่มเปล่าต้องแดง)', async () => {
    let fail = true
    const { calls } = stubFetch(() =>
      fail
        ? { ok: false, status: 500, json: async () => ({ payments: [] }) }
        : { ok: true, json: async () => ({ payments: [{ packageCode: 'PRO_ANNUAL', tierCode: 'PRO', amountSatang: 129000, status: 'APPROVED', createdAt: '2026-07-14T03:00:00.000Z' }] }) })

    mount()
    await waitFor(() => expect(screen.getByTestId('account-history-error')).toBeTruthy())
    const before = calls.filter((u) => u.includes('/payment/status')).length

    fail = false
    fireEvent.click(screen.getByTestId('account-history-retry'))

    // it re-READ (not just re-rendered) …
    await waitFor(() =>
      expect(calls.filter((u) => u.includes('/payment/status')).length).toBeGreaterThan(before))
    // … and the second answer actually reaches the card
    await waitFor(() => expect(screen.getByTestId('account-history').textContent).toContain('Mumate Pro'))
    expect(screen.queryByTestId('account-history-error')).toBeNull()
  })

  // the promise this PR makes out loud, asserted rather than described
  it('การ์ดล้ม จอไม่ล้ม — ระดับกับวันหมดอายุยังอยู่ครบตอนประวัติพัง', async () => {
    stubFetch(() => ({ ok: false, status: 500, json: async () => ({ payments: [] }) }))
    const { container } = mount()
    await waitFor(() => expect(screen.getByTestId('account-history-error')).toBeTruthy())
    // the identity fetch settles on its own clock — wait for it rather than racing the history one
    await waitFor(() => expect(screen.getByTestId('account-plan')).toBeTruthy())
    expect(screen.getByTestId('account-plan').textContent).toBe('Mumate Pro')
    expect(container.textContent).toContain('ใช้ได้ถึง 14 ก.ค. 2570')
    expect(screen.getByTestId('account-history-error')).toBeTruthy() // still failed, side by side
  })
})
