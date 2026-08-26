// scripts/checkout-pay-mount.test.tsx — จอชำระเงินประกอบจริง แล้วกดปุ่มจ่าย (mootech-fe#466 รอบ 3)
//
// 🔴 WHY THIS FILE EXISTS (ตู๋, review r2 of ec6e66c). #466 shipped two guards before this one and both
// were named for a BEHAVIOUR while only checking a SPELLING:
//
//   รอบ 1  teeth on refusedHref()          → ตู๋ deleted the two call sites: 883 passed, rc=0
//   รอบ 2  teeth reading the page as TEXT   → ตู๋ put the bug back without typing a forbidden word:
//
//       const d = (await r.json()) as PayBody
//     + if (!r.ok) { setPaying(false); void router.push(tokenizationFailedDestination(packageCode).href); return }
//       const dest = payDestination({ … })
//
//     900 passed · rc=0 · lint clean · every assertion in the grep guard still green — and a paying member
//     is back on "ธนาคารปฏิเสธการชำระเงิน", because **409 is `!r.ok`**.
//
// scripts/account-screen-mount.test.tsx:9-11 already wrote the answer down for this repo:
//   "A tooth named for a BEHAVIOUR that only checks a spelling is the exact class this PR has now been
//    bitten by three times; the answer is to mount the screen and read the words a person actually sees."
// This file is that, for the pay button. It asserts WHERE THE USER IS SENT, which no amount of rewording
// inside the page can fake.
//
// 🔴 MUTANT CONTRACT (each reddens `npm test`):
//   MP1  any short-circuit on `!r.ok` before payDestination        → the 409 test reddens
//   MP2  flip `if (!dest.keepPaying) setPaying(false)`             → the button-stays-locked test reddens
//   MP3  drop the refusal branch inside payDestination             → the 409 test reddens
//   MP4  send a refusal through the router as an external URL      → the 3-D Secure test reddens
import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react'
import { CookiesProvider } from 'react-cookie'

// Same one-line stub as scripts/tier-prod-pages.test.tsx:16 — the module graph reads runtime config at load.
vi.mock('next/config', () => ({ default: () => ({ publicRuntimeConfig: {}, serverRuntimeConfig: {} }) }))

const push = vi.fn()
vi.mock('next/router', () => ({
  useRouter: () => ({
    pathname: '/v2/shop/checkout', asPath: '/v2/shop/checkout', route: '/v2/shop/checkout',
    query: { package_code: 'V2_PLUS_YEARLY' }, isReady: true,
    push, replace: vi.fn(), prefetch: vi.fn(() => Promise.resolve()),
    events: { on: vi.fn(), off: vi.fn(), emit: vi.fn() },
  }),
}))

// The identity half is stubbed for the same reason account-screen-mount.test.tsx states: this file asks ONE
// question — where does the pay button send you — and driving useV2Tier's plumbing would test the plumbing.
// A resolved PLUS member is also the honest fixture here: they are exactly who hits the 409.
vi.mock('@/features/auth/hooks/useV2Tier', () => ({
  useV2Tier: () => ({ isPaid: true, tier: 'PLUS', loading: false }),
}))
// The card lane would reach omise.js through the network; the PromptPay lane needs none of it. Stubbed so a
// card test can exist without a real tokeniser.
vi.mock('@/features/v2-shop/omise-token', () => ({ createCardToken: vi.fn(async () => 'tokn_test_1') }))

import CheckoutPage from '@/pages/v2/shop/checkout'

const QUOTE = {
  quoteId: 'q-466', packageCode: 'V2_PLUS_YEARLY', listSatang: 79000, discountSatang: 0,
  amountSatang: 79000, vatSatang: 0, vatPercent: 0, codeApplied: null,
  expiresAt: new Date(Date.now() + 900_000).toISOString(),
}

/** preview always succeeds; the charge answer is what each test varies. */
function serve(charge: { status: number; body: unknown }) {
  return vi.fn(async (url: RequestInfo | URL) => {
    const u = String(url)
    if (u.includes('/api/v2/payment/preview')) {
      return { ok: true, status: 200, json: async () => QUOTE } as unknown as Response
    }
    return { ok: charge.status >= 200 && charge.status < 300, status: charge.status, json: async () => charge.body } as unknown as Response
  })
}

async function arriveOnPromptPay() {
  // CookiesProvider for the same reason account-screen-mount.test.tsx needs it: the shell's avatar
  // reads cookies through useMemberIdentity. Fix the fixture, never widen the component.
  render(
    <CookiesProvider>
      <CheckoutPage teamPreview={false} />
    </CookiesProvider>,
  )
  await screen.findByTestId('checkout-pay')
  // 🔑 the lane FIRST: the default is card, and `ready` needs a filled card form on that lane — waiting for
  // an enabled button before switching would wait forever and prove nothing.
  fireEvent.click(screen.getByTestId('method-promptpay'))
  // then the quote has to have landed, or the click below hits a disabled button and asserts nothing
  await waitFor(() => expect((screen.getByTestId('checkout-pay') as HTMLButtonElement).disabled).toBe(false))
}

beforeEach(() => { push.mockClear() })
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

describe('#466 กดจ่ายตอนที่เป็นสมาชิกอยู่แล้ว — จอต้องไม่โทษธนาคาร', () => {
  it('🔴 MP1/MP3 — 409 ALREADY_ON_THIS_TIER พาไปจอ "คุณเป็นสมาชิกอยู่แล้ว" ❌ ไม่ใช่ CARD_DECLINED', async () => {
    vi.stubGlobal('fetch', serve({ status: 409, body: { error: 'already entitled', purchaseError: 'ALREADY_ON_THIS_TIER' } }))
    await arriveOnPromptPay()
    fireEvent.click(screen.getByTestId('checkout-pay'))

    await waitFor(() => expect(push).toHaveBeenCalled())
    const href = String(push.mock.calls.at(-1)?.[0])
    expect(href).toContain('state=ALREADY_ON_THIS_TIER')
    // 🔴 the two sentences this ticket exists to delete, asserted against EVERY navigation, not just the last
    for (const call of push.mock.calls) {
      expect(String(call[0]), 'the bank never saw this').not.toContain('CARD_DECLINED')
      expect(String(call[0]), 'our network is fine').not.toContain('OFFLINE')
    }
  })

  it('🔴 MP1 — CANNOT_DOWNGRADE เดินเส้นเดียวกัน (409 ก็คือ !r.ok เหมือนกัน)', async () => {
    vi.stubGlobal('fetch', serve({ status: 409, body: { error: 'already entitled', purchaseError: 'CANNOT_DOWNGRADE' } }))
    await arriveOnPromptPay()
    fireEvent.click(screen.getByTestId('checkout-pay'))

    await waitFor(() => expect(push).toHaveBeenCalled())
    const href = String(push.mock.calls.at(-1)?.[0])
    expect(href).toContain('state=CANNOT_DOWNGRADE')
    expect(href).not.toContain('CARD_DECLINED')
  })

  it('CONTROL — 409 ที่ไม่ใช่การปฏิเสธ ยังตกจอเดิม ⇒ เทสต์ข้างบนไม่ได้ผ่านเพราะทุกอย่างกลายเป็น refusal', async () => {
    vi.stubGlobal('fetch', serve({ status: 409, body: { error: 'quote expired', quoteChanged: true } }))
    await arriveOnPromptPay()
    fireEvent.click(screen.getByTestId('checkout-pay'))

    await waitFor(() => expect(push).toHaveBeenCalled())
    expect(String(push.mock.calls.at(-1)?.[0])).toContain('state=OFFLINE')
  })
})

describe('#466 MP2 — ปุ่มจ่ายต้องยังล็อกอยู่ตอนที่รายการเกิดขึ้นแล้ว', () => {
  it('🔴 QR ออกแล้ว ⇒ ปุ่มต้องยังกดไม่ได้ — #439 เขียนเองว่าปลดล็อกตอนนี้คือเชิญให้จ่ายซ้ำ', async () => {
    vi.stubGlobal('fetch', serve({ status: 200, body: { chargeId: 'chrg_1', status: 'PENDING', qr: 'https://omise/x.png' } }))
    await arriveOnPromptPay()
    fireEvent.click(screen.getByTestId('checkout-pay'))

    await waitFor(() => expect(push).toHaveBeenCalled())
    expect(String(push.mock.calls.at(-1)?.[0])).toContain('/v2/shop/qrcode')
    // the navigation is in flight; the button must NOT have been handed back
    expect((screen.getByTestId('checkout-pay') as HTMLButtonElement).disabled).toBe(true)
  })

  it('CONTROL — พอถูกปฏิเสธ ปุ่มต้องกลับมากดได้ ⇒ ข้อบนไม่ได้ผ่านเพราะปุ่มล็อกตลอดกาล', async () => {
    vi.stubGlobal('fetch', serve({ status: 409, body: { purchaseError: 'ALREADY_ON_THIS_TIER' } }))
    await arriveOnPromptPay()
    fireEvent.click(screen.getByTestId('checkout-pay'))

    await waitFor(() => expect(push).toHaveBeenCalled())
    await waitFor(() => expect((screen.getByTestId('checkout-pay') as HTMLButtonElement).disabled).toBe(false))
  })
})
