// scripts/shop-screen-mount.test.tsx — จอขาย #457 ประกอบจริง แล้วอ่าน "คำที่คนเห็น" ทีละแถวของเมทริกซ์
//
// 🔴 WHY MOUNT INSTEAD OF ASSERTING THE VERDICT OBJECT. scripts/shop-card-verdict.test.ts already proves the
// pure function. It cannot prove that the SCREEN wired it up: a card could compute `current` perfectly and
// still render the buy button, and every unit test would stay green. mootech-fe#452 shipped exactly that
// shape twice in one PR — a tooth that read a prop, and a tooth that read a comment — so the rule this file
// follows is: assert the STRING a person reads, never a prop, a data-attribute, or a source spelling.
//
// 🔴 MUTANT CONTRACT (each reddens `npm test`):
//   S1  PackageCard ignores `verdict` and always renders the checkout button → the PLUS/PRO row tests redden
//   S2  the "current" branch drops the expiry date                          → "ใช้ได้ถึง" test reddens
//   S3  the carry-over note is rendered unconditionally                     → the Free-row test reddens
//   S4  `undetermined` falls through to the buy button                      → the loading/error tests redden
//   S5  the legacy member's button says อัปเกรด                             → the legacy wording test reddens
//   S6  the blocked (downgrade) card renders a checkout link                → the PRO→PLUS test reddens
//   S7  the payment terms render on a card that offers no payment            → the legal-note tests redden
//   S8  determined read from `user?.membership` instead of the paid verdict   → the logged-out rows redden (ตู๋ MUT-A)
//   S9  a refused card keeps its refusal text AND draws a buy control anyway  → the controlsIn(...) rows redden (ตู๋ MUT-B2)
//   S10 the failure line goes back to retry-button copy with no button there  → the failure-copy test reddens
//   S11 the carry-over promise renders on a card the viewer cannot buy         → the no-promises rows redden (ตู๋ MUT-D)
//   S12 ShopScreen rebuilds ViewerMembership without `source` (ShopScreen.tsx:59-71) → the legacy rows redden.
//        🔴 THIS IS THE ONE THE SUITE DID NOT HAVE. #358 Phase 1 gave a valid legacy member the tier NAME
//        'PRO' (subscription.ts:26), and the screen was dropping the field that says the name was DECIDED,
//        not read — so both paid cards refused them and 1060 tests stayed green. The legacy fixture below is
//        now the shape the server actually returns, which is what makes S12 reachable at all.
import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, waitFor } from '@testing-library/react'
import { CookiesProvider } from 'react-cookie'

// Same one-line stub as scripts/tier-prod-pages.test.tsx:16 — the module graph reads runtime config at load.
vi.mock('next/config', () => ({ default: () => ({ publicRuntimeConfig: {}, serverRuntimeConfig: {} }) }))
// Menubar reads router.pathname (Menubar.tsx:59). Give the mock the fields the real router supplies, so a
// failure here means the screen is wrong — never that the fixture was thin.
vi.mock('next/router', () => ({
  useRouter: () => ({ pathname: '/v2/shop', asPath: '/v2/shop', route: '/v2/shop', query: {}, isReady: true, push: vi.fn(), replace: vi.fn(), prefetch: vi.fn(() => Promise.resolve()), events: { on: vi.fn(), off: vi.fn(), emit: vi.fn() } }),
}))

// The two membership seams are mocked per ROW. What they answer for each row is not invented here: it is the
// contract lib/v2/tier.ts:89-92 states (isPaid true ⇒ tier ∈ {PLUS,PRO,null}; isPaid null ⇒ tier null), and
// scripts/v2-tier.test.ts owns whether the real hook produces it. This file owns what the SCREEN does with it.
const tierState = vi.hoisted(() => ({ value: { isPaid: null as boolean | null, tier: null as string | null, loading: true } }))
// 🔴 `user` IS THE WHOLE ROW, not just an expiry. The first version of this mock always handed back a
// `membership` object, which made the screen's `determined` expression untestable: ตู๋ swapped it for
// `user?.membership != null` and all 908 tests stayed green while a logged-OUT visitor lost the buy button.
// A visitor with no membership row is a real shape /api/user returns, so the fixture must be able to be it.
const userState = vi.hoisted(() => ({ value: null as { user_id: string; membership?: unknown } | null }))
vi.mock('@/features/v2-shell/hooks/useClientTier', () => ({ useClientTier: () => tierState.value }))
vi.mock('@/features/auth/hooks/useV2User', () => ({
  useV2User: () => ({ userId: 'u-457', done: true, errored: false, user: userState.value }),
}))

import { ShopScreen } from '@/features/v2-shop/components/ShopScreen'

/** Both paid packages priced and on sale, so the buy path is REACHABLE — otherwise a card would fall into
 *  "ยังไม่เปิดขาย" and a missing button would look like #457 working when it is the catalogue answering. */
function stubPrices() {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL) => {
      const url = String(input)
      // 🔴 THE FIELD IS `amount`, IN BAHT (usePackagePrice.ts:53-63) — not amount_satang. The first draft
      // of this fixture used the satang name; every card fell to `missing` and rendered "ยังไม่เปิดขาย",
      // which reads as #457 hiding buttons rather than as the FIXTURE being wrong. Repaired against the
      // consumer, not by widening the consumer to accept both names.
      const amount = url.includes('PRO') ? 1590 : 790
      return Promise.resolve({ ok: true, json: async () => ({ amount, is_active: true }) } as Response)
    }),
  )
}

// TopBarAvatar → useMemberIdentity reads cookies through react-cookie (useMemberIdentity.ts:42), which
// throws without a provider. Same wrapper scripts/account-screen-mount.test.tsx uses.
const renderScreen = () => render(<CookiesProvider><ShopScreen /></CookiesProvider>)

/** Set the viewer, mount, and wait until prices have resolved so the finished page is what gets asserted. */
async function mountAs(
  tier: { isPaid: boolean | null; tier: string | null; loading: boolean },
  expireAt: string | null = null,
  // #358 Phase 1 — lib/v2/subscription.ts:21 MembershipSource, as /api/user hands it over. Defaulted to
  // 'v2' because that is what a NAMED tier means for every row above: a real member_subscription row was
  // read. Only the legacy member overrides it, and for them it is the whole difference.
  source: 'v2' | 'legacy' | 'none' = 'v2',
) {
  tierState.value = tier
  userState.value = { user_id: 'u-457', membership: { expireAt, source } }
  renderScreen()
  // 🔴 Wait for the price to be READY, not merely "no longer loading". The weaker wait passes on `missing`
  // and `offSale` too, so a broken fixture sails through it and fails later as a confusing button assertion.
  await waitFor(() => expect(screen.getByTestId('plan-price-plus').textContent).toContain('฿790'))
}

const body = () => document.body.textContent ?? ''

/** 🔴 ASK THE CARD, NOT A testid. ตู๋'s MUT-B2 kept every refusal string intact and drew a second buy
 *  button under a testid nothing queried — 39/39 green. `queryByTestId(...)` can only ever answer "no
 *  element with THAT NAME", which is not the claim these tests make. The claim is "this card offers no
 *  way to buy", so it has to be asked of every control the card actually contains. */
const cardOf = (id: string) => screen.getByTestId(`plan-card-${id}`)
const controlsIn = (id: string) => cardOf(id).querySelectorAll('a[href], button, [role="button"]')
const cardText = (id: string) => cardOf(id).textContent ?? ''

beforeEach(() => { stubPrices() })
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

describe('#457 row 1 — a Free viewer sees the shop exactly as before', () => {
  it('gets a real buy button on both paid cards, and is never told days will carry', async () => {
    await mountAs({ isPaid: false, tier: null, loading: false })
    expect(screen.getByTestId('plan-cta-plus').textContent).toContain('สมัครแพ็กเกจ')
    expect(screen.getByTestId('plan-cta-pro').textContent).toContain('สมัครแพ็กเกจ')
    // 🔴 S3 — the carry note must be absent here, or it is decoration rather than a decision.
    expect(screen.queryByTestId('plan-carry-note-plus')).toBeNull()
    expect(screen.queryByTestId('plan-carry-note-pro')).toBeNull()
    expect(body()).not.toContain('แพ็กเกจปัจจุบันของคุณ')
  })
})

describe('#457 🔴 row 1b — LOGGED OUT: no membership row exists, and the shop still sells', () => {
  // ตู social's MUT-A: `determined: user?.membership != null` keeps every other row green and quietly closes
  // the shop to everyone who is not signed in — the single most expensive thing this ticket could break.
  // The unit file proves computeTier ANSWERS correctly for anon; only this row proves ShopScreen USES that
  // answer. It needs a fixture where the paid verdict is known and the membership row is genuinely absent.
  it('an anonymous visitor (KNOWN not-paid, no membership row) still gets both buy buttons', async () => {
    tierState.value = { isPaid: false, tier: null, loading: false }
    userState.value = { user_id: 'u-457' } // logged in far enough to have a row, but no membership on it
    renderScreen()
    await waitFor(() => expect(screen.getByTestId('plan-price-plus').textContent).toContain('฿790'))
    expect(screen.getByTestId('plan-cta-plus').textContent).toContain('สมัครแพ็กเกจ')
    expect(screen.getByTestId('plan-cta-pro').textContent).toContain('สมัครแพ็กเกจ')
    expect(screen.queryByTestId('plan-cta-pending-plus')).toBeNull()
  })
  it('and so does a visitor with no /api/user row at all', async () => {
    tierState.value = { isPaid: false, tier: null, loading: false }
    userState.value = null
    renderScreen()
    await waitFor(() => expect(screen.getByTestId('plan-price-plus').textContent).toContain('฿790'))
    expect(screen.getByTestId('plan-cta-plus').textContent).toContain('สมัครแพ็กเกจ')
    expect(controlsIn('plus').length).toBeGreaterThan(0)
  })
})

describe('#457 row 2 — a PLUS member', () => {
  it('is told Mumate + is theirs, WITH the real expiry date, and gets NO way to buy it at all', async () => {
    await mountAs({ isPaid: true, tier: 'PLUS', loading: false }, '2027-08-26')
    expect(screen.getByTestId('plan-status-plus').textContent).toBe('แพ็กเกจปัจจุบันของคุณ · ใช้ได้ถึง 26 ส.ค. 2570')
    expect(controlsIn('plus')).toHaveLength(0)
    expect(cardText('plus')).not.toContain('สมัครแพ็กเกจ')
    expect(cardText('plus')).not.toContain('อัปเกรดเป็น')
    // ตู๋ MUT-D: "no control" and "no promise" are two claims, and these rows only made the first. Letting
    // the carry-over line render here tells someone who cannot buy this that buying it keeps their days.
    expect(cardText('plus')).not.toContain('จะถูกบวกให้')
  })
  it('🔴 shows the DATE THEY WERE GIVEN — a different expiry renders differently', async () => {
    // negative control for S2: an assertion that could pass with a hardcoded date proves nothing.
    await mountAs({ isPaid: true, tier: 'PLUS', loading: false }, '2027-01-15')
    expect(screen.getByTestId('plan-status-plus').textContent).toContain('ใช้ได้ถึง 15 ม.ค. 2570')
  })
  it('is offered Mumate Pro as an UPGRADE, and told the days they have left follow them', async () => {
    await mountAs({ isPaid: true, tier: 'PLUS', loading: false }, '2027-08-26')
    expect(screen.getByTestId('plan-cta-pro').textContent).toContain('อัปเกรดเป็น Mumate Pro')
    expect(screen.getByTestId('plan-carry-note-pro').textContent).toContain('วันที่เหลือของแพ็กเกจปัจจุบันจะถูกบวกให้')
  })
})

describe('#457 row 3 — a PRO member', () => {
  it('cannot be sold Mumate + — the card says why and carries NO control of any kind', async () => {
    await mountAs({ isPaid: true, tier: 'PRO', loading: false }, '2027-08-26')
    expect(screen.getByTestId('plan-status-plus').textContent).toContain('คุณเป็นสมาชิกระดับสูงกว่านี้อยู่แล้ว')
    // 🔴 the assertion ตู๋'s MUT-B2 walked through: a refusal that still ships a button is not a refusal.
    expect(controlsIn('plus')).toHaveLength(0)
    expect(cardText('plus')).not.toContain('สมัครแพ็กเกจ')
    expect(cardText('plus')).not.toContain('จะถูกบวกให้') // ตู๋ MUT-D — no promises either, not just no controls
  })
  it('sees Mumate Pro as the package they hold, with nothing to press there either', async () => {
    await mountAs({ isPaid: true, tier: 'PRO', loading: false }, '2027-08-26')
    expect(screen.getByTestId('plan-status-pro').textContent).toContain('แพ็กเกจปัจจุบันของคุณ')
    expect(controlsIn('pro')).toHaveLength(0)
    expect(cardText('pro')).not.toContain('จะถูกบวกให้')
  })
})

describe('#457 row 4 — 🔴 we do not know yet: the screen must not guess in either direction', () => {
  it('while loading, offers no purchase and claims no membership', async () => {
    tierState.value = { isPaid: null, tier: null, loading: true }
    userState.value = null
    renderScreen()
    await waitFor(() => expect(screen.getByTestId('plan-cta-pending-plus')).toBeTruthy())
    expect(screen.getByTestId('plan-cta-pending-plus').textContent).toContain('กำลังตรวจสอบสถานะสมาชิก')
    expect(controlsIn('plus')).toHaveLength(0)
    expect(cardText('plus')).not.toContain('สมัครแพ็กเกจ')
    expect(cardText('plus')).not.toContain('จะถูกบวกให้')
    expect(body()).not.toContain('แพ็กเกจปัจจุบันของคุณ')
  })
  it('🔴 the failure line offers no control, so it must not tell anyone to press one', async () => {
    // ตู๋: same rule that deleted the payment terms from a card with no payment (S7), applied to the line
    // I wrote in that very commit. "ลองใหม่อีกครั้งได้เลย" is retry-button copy; there is no retry button.
    tierState.value = { isPaid: null, tier: null, loading: false }
    userState.value = null
    renderScreen()
    await waitFor(() => expect(screen.getByTestId('plan-cta-pending-plus')).toBeTruthy())
    const pending = screen.getByTestId('plan-cta-pending-plus')
    expect(pending.querySelectorAll('a[href], button, [role="button"]')).toHaveLength(0)
    expect(pending.textContent).not.toContain('ลองใหม่อีกครั้ง')
    expect(pending.textContent).toContain('ลองโหลดหน้านี้ใหม่')
  })
  it('🔴 when the lookup FAILED, says so — it does not keep pretending to check', async () => {
    tierState.value = { isPaid: null, tier: null, loading: false }
    userState.value = null
    renderScreen()
    await waitFor(() => expect(screen.getByTestId('plan-cta-pending-pro')).toBeTruthy())
    expect(screen.getByTestId('plan-cta-pending-pro').textContent).toContain('ตรวจสอบสถานะสมาชิกของคุณไม่ได้')
    expect(body()).not.toContain('กำลังตรวจสอบสถานะสมาชิก')
  })
})

describe('#457 row 5 — a legacy member: paid, and (since #358 Phase 1) a DECIDED level name', () => {
  // 🔴 THE FIXTURE MOVED, AND THAT IS THE POINT. This row used to mount `{ isPaid: true, tier: null }`, a
  // shape no writer produces any more: #358 Phase 1 made the resolver answer 'PRO' for these members
  // (subscription.ts:26) with `source: 'legacy'` marking the name as a decision. Mounting the old shape is
  // what let the shop stop selling to them with every test green. The verdict half of this is bound to the
  // real resolver in scripts/shop-card-verdict.test.ts; this half is the only thing that reddens if
  // ShopScreen.tsx stops carrying `source` through.
  it('may buy either package, and is never told a level they might not have', async () => {
    await mountAs({ isPaid: true, tier: 'PRO', loading: false }, '2027-03-01', 'legacy')
    expect(screen.getByTestId('plan-cta-plus').textContent).toContain('สมัครแพ็กเกจ Mumate +')
    expect(screen.getByTestId('plan-cta-pro').textContent).toContain('สมัครแพ็กเกจ Mumate Pro')
    // 🔴 S5 — "อัปเกรด" claims we know they rank below this. We do not know what they hold at all.
    expect(body()).not.toContain('อัปเกรดเป็น')
    expect(body()).not.toContain('แพ็กเกจปัจจุบันของคุณ')
  })
  it('is still told their remaining days carry over', async () => {
    await mountAs({ isPaid: true, tier: 'PRO', loading: false }, '2027-03-01', 'legacy')
    expect(screen.getByTestId('plan-carry-note-plus').textContent).toContain('จะถูกบวกให้')
  })
})

describe('#457 — 🔴 payment terms only where there is a payment (found by LOOKING at the page)', () => {
  // Not caught by any assertion above: every string on the card was correct, and the card was still wrong.
  // A PRO member's Mumate + card refused the purchase and then printed the terms of that purchase.
  it('a card that offers no purchase carries no "เมื่อชำระเงินเรียบร้อยแล้ว" line', async () => {
    await mountAs({ isPaid: true, tier: 'PRO', loading: false }, '2027-08-26')
    expect(screen.queryByTestId('plan-legal-plus')).toBeNull() // blocked — cannot downgrade
    expect(screen.queryByTestId('plan-legal-pro')).toBeNull() // current — already theirs
  })
  it('and neither does a card whose viewer we cannot place yet', async () => {
    tierState.value = { isPaid: null, tier: null, loading: true }
    userState.value = null
    renderScreen()
    await waitFor(() => expect(screen.getByTestId('plan-cta-pending-plus')).toBeTruthy())
    expect(screen.queryByTestId('plan-legal-plus')).toBeNull()
  })
  it('🔴 but a card that DOES offer a purchase still carries it — this is not "delete the terms"', async () => {
    await mountAs({ isPaid: false, tier: null, loading: false })
    expect(screen.getByTestId('plan-legal-plus').textContent).toContain('เมื่อชำระเงินเรียบร้อยแล้ว')
    expect(screen.getByTestId('plan-legal-pro').textContent).toContain('นโยบายความเป็นส่วนตัว')
  })
  it('and so does an upgrade card', async () => {
    await mountAs({ isPaid: true, tier: 'PLUS', loading: false }, '2027-08-26')
    expect(screen.getByTestId('plan-legal-pro').textContent).toContain('เมื่อชำระเงินเรียบร้อยแล้ว')
  })
})

describe('#457 — the Free card is untouched for everyone (ticket: ❌ ไม่แตะการ์ด Free)', () => {
  it('keeps its own CTA in every viewer state', async () => {
    for (const t of [
      { isPaid: false, tier: null, loading: false },
      { isPaid: true, tier: 'PLUS', loading: false },
      { isPaid: true, tier: 'PRO', loading: false },
      { isPaid: null, tier: null, loading: true },
    ]) {
      await mountAs(t, '2027-08-26')
      expect(screen.getByTestId('plan-cta-free').textContent).toContain('เริ่มใช้ฟรี')
      expect(screen.queryByTestId('plan-status-free')).toBeNull()
      expect(screen.queryByTestId('plan-carry-note-free')).toBeNull()
      cleanup()
    }
  })
})
