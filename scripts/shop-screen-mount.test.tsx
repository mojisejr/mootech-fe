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
const userState = vi.hoisted(() => ({ value: { expireAt: null as string | null } }))
vi.mock('@/features/v2-shell/hooks/useClientTier', () => ({ useClientTier: () => tierState.value }))
vi.mock('@/features/auth/hooks/useV2User', () => ({
  useV2User: () => ({ userId: 'u-457', done: true, errored: false, user: { user_id: 'u-457', membership: { expireAt: userState.value.expireAt } } }),
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
async function mountAs(tier: { isPaid: boolean | null; tier: string | null; loading: boolean }, expireAt: string | null = null) {
  tierState.value = tier
  userState.value = { expireAt }
  renderScreen()
  // 🔴 Wait for the price to be READY, not merely "no longer loading". The weaker wait passes on `missing`
  // and `offSale` too, so a broken fixture sails through it and fails later as a confusing button assertion.
  await waitFor(() => expect(screen.getByTestId('plan-price-plus').textContent).toContain('฿790'))
}

const body = () => document.body.textContent ?? ''

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

describe('#457 row 2 — a PLUS member', () => {
  it('is told Mumate + is theirs, WITH the real expiry date, and gets no button for it', async () => {
    await mountAs({ isPaid: true, tier: 'PLUS', loading: false }, '2027-08-26')
    expect(screen.getByTestId('plan-status-plus').textContent).toBe('แพ็กเกจปัจจุบันของคุณ · ใช้ได้ถึง 26 ส.ค. 2570')
    expect(screen.queryByTestId('plan-cta-plus')).toBeNull()
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
  it('cannot be sold Mumate + — no link, and the card says why', async () => {
    await mountAs({ isPaid: true, tier: 'PRO', loading: false }, '2027-08-26')
    expect(screen.queryByTestId('plan-cta-plus')).toBeNull()
    expect(screen.getByTestId('plan-status-plus').textContent).toContain('คุณเป็นสมาชิกระดับสูงกว่านี้อยู่แล้ว')
  })
  it('sees Mumate Pro as the package they hold', async () => {
    await mountAs({ isPaid: true, tier: 'PRO', loading: false }, '2027-08-26')
    expect(screen.getByTestId('plan-status-pro').textContent).toContain('แพ็กเกจปัจจุบันของคุณ')
  })
})

describe('#457 row 4 — 🔴 we do not know yet: the screen must not guess in either direction', () => {
  it('while loading, offers no purchase and claims no membership', async () => {
    tierState.value = { isPaid: null, tier: null, loading: true }
    userState.value = { expireAt: null }
    renderScreen()
    await waitFor(() => expect(screen.getByTestId('plan-cta-pending-plus')).toBeTruthy())
    expect(screen.getByTestId('plan-cta-pending-plus').textContent).toContain('กำลังตรวจสอบสถานะสมาชิก')
    expect(screen.queryByTestId('plan-cta-plus')).toBeNull()
    expect(body()).not.toContain('แพ็กเกจปัจจุบันของคุณ')
  })
  it('🔴 when the lookup FAILED, says so — it does not keep pretending to check', async () => {
    tierState.value = { isPaid: null, tier: null, loading: false }
    userState.value = { expireAt: null }
    renderScreen()
    await waitFor(() => expect(screen.getByTestId('plan-cta-pending-pro')).toBeTruthy())
    expect(screen.getByTestId('plan-cta-pending-pro').textContent).toContain('ตรวจสอบสถานะสมาชิกไม่ได้')
    expect(body()).not.toContain('กำลังตรวจสอบสถานะสมาชิก')
  })
})

describe('#457 row 5 — a legacy member: paid, no level name', () => {
  it('may buy either package, and is never told a level they might not have', async () => {
    await mountAs({ isPaid: true, tier: null, loading: false }, '2027-03-01')
    expect(screen.getByTestId('plan-cta-plus').textContent).toContain('สมัครแพ็กเกจ Mumate +')
    expect(screen.getByTestId('plan-cta-pro').textContent).toContain('สมัครแพ็กเกจ Mumate Pro')
    // 🔴 S5 — "อัปเกรด" claims we know they rank below this. We do not know what they hold at all.
    expect(body()).not.toContain('อัปเกรดเป็น')
    expect(body()).not.toContain('แพ็กเกจปัจจุบันของคุณ')
  })
  it('is still told their remaining days carry over', async () => {
    await mountAs({ isPaid: true, tier: null, loading: false }, '2027-03-01')
    expect(screen.getByTestId('plan-carry-note-plus').textContent).toContain('จะถูกบวกให้')
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
