// #457 — teeth for what ONE package card says to THIS viewer. PURE, main lane (npm test).
//
// The DoD says "ทั้ง 3 แถวในเมทริกซ์แสดงถูก — พิสูจน์ทีละแถว", so every viewer state gets its OWN `it`
// per card. A combined table-driven assertion would let one row rot green behind the others, and the row
// most likely to rot is the one nobody drew: `undetermined`.
//
// 🔴 THE MATRIX IS 5 ROWS, NOT 3. The ticket draws Free / PLUS / PRO. The two it does not draw are the two
// that fail silently: `undetermined` (loading or error — guessing either way is wrong, tier.ts:35-39) and
// the legacy member — paid, and with no PROVABLE level at the gate. (Since #358 Phase 1 the screen does
// show them a name, 'PRO'; card-verdict.ts:111 hands the gate null on purpose.) Both are asserted here.
//
// 🔴 MUTANT CONTRACT (each reddens `npm test` — the DoD's "ตัวพิสูจน์ว่ามีฟัน"):
//   MV1  read `undetermined` as a free viewer (drop the guard, let null fall through)  → the 4 undetermined tests redden
//   MV2  call the legacy member an `upgrade` instead of a plain `buy`                  → the legacy tests redden
//   MV3  drop `carriesDays` for the legacy member (always false)                       → the legacy carry test reddens
//   MV4  return `current` for a LAPSED subscription (read isPaid as the tier name)     → the lapsed tests redden
//   MV5  stop passing expireAt through on `current`                                    → the expiry passthrough test reddens
//   MV6  let a downgrade render as `buy` instead of `blocked`                          → the PRO→PLUS test reddens
//   MV7  make `kind` depend on `today`                                                 → the clock-independence test reddens
//   MV8  give the Free card a real verdict instead of freezing it                      → the free-card tests redden
//   MV9  the gate reads the DISPLAY tier for a legacy viewer (drop the `source === 'legacy'` nulling in
//        card-verdict.ts)                                                              → the #358 seam block reddens
//
// 🔴 WHY A REAL-SEAM BLOCK EXISTS AT THE BOTTOM OF THIS FILE. Every row above hands `cardVerdictFor` an
// object literal, and #358 Phase 1 shipped a regression straight through all of them: the resolver started
// answering `tier: 'PRO'` for a valid legacy member (subscription.ts:26 LEGACY_TIER), so the real screen
// showed that member `current` on the Pro card and `blocked` on the Plus card — no buy control on either
// (PackageCard.tsx:184-204) — while this file stayed green, because its legacy fixture was still the
// hand-written pre-#358 shape. Nothing in the repo bound what `resolveMembershipFromRows` RETURNS to what
// `cardVerdictFor` CONSUMES. That binding is the last describe block, and it is the only assertion here
// that would have gone red on the day.
import { describe, it, expect, vi } from 'vitest'
import { cardVerdictFor, type ViewerMembership } from '@/features/v2-shop/card-verdict'
import { computeTier } from '@/lib/v2/tier'

// lib/v2/subscription.ts opens a pg client at import time (lib/db/index.ts:10) for its LAZY caller only
// (resolveSubscription); the PURE resolver used below touches neither. Same two mocks, same reason, as
// scripts/member-subscription.test.ts:33-40.
vi.mock('@/lib/db', () => ({ db: { select: () => ({ from: () => ({ where: async () => [] }) }) } }))
vi.mock('@/lib/usage', () => ({
  resolveMembership: async () => ({ isFree: true, reason: 'NO_PLAN', memberPayment: null }),
}))
import { resolveMembershipFromRows } from '@/lib/v2/subscription'
import { classifyMembership, isNotExpired, MEMBER_PLAN } from '@/lib/usage-core'

const TODAY = '2026-08-26'

// Each helper reads as the matrix ROW it is, not as an object literal.
const freeViewer: ViewerMembership = { isPaid: false, tier: null, expireAt: null }
const plusUntil = (expireAt: string): ViewerMembership => ({ isPaid: true, tier: 'PLUS', expireAt })
const proUntil = (expireAt: string): ViewerMembership => ({ isPaid: true, tier: 'PRO', expireAt })
// Paid, but their membership lives on member_payment, which has no tier column. Since #358 Phase 1 the
// resolver DECIDES the name 'PRO' for them (subscription.ts:26 LEGACY_TIER); `source: 'legacy'` is the only
// field that says the name was decided rather than READ, and it is what keeps the gate from placing them on
// the ladder (purchase-gate.ts:116-121 — never refuse someone we cannot place). This shape is not asserted
// from memory: the last describe block builds it from the real resolver.
const legacyUntil = (expireAt: string): ViewerMembership => ({ isPaid: true, tier: 'PRO', source: 'legacy', expireAt })
// The pre-#358 shape: paid, no name at all. No writer produces it today, but it is the branch the fixture
// above leans on, so it keeps being asserted on its own.
const unnamedLegacyUntil = (expireAt: string): ViewerMembership => ({ isPaid: true, tier: null, expireAt })
// a PLUS row that has run out: isPaid is the server's verdict and it says NOT paid. The NAME is still
// there, which is exactly the trap — a screen reading the name would call this person a member.
const lapsedPlus: ViewerMembership = { isPaid: false, tier: 'PLUS', expireAt: '2026-08-01' }

const verdict = (
  planId: 'free' | 'plus' | 'pro',
  membership: ViewerMembership,
  determined = true,
  today = TODAY,
  loading = false,
) => cardVerdictFor({ planId, membership, determined, today, loading })

describe('#457 row 1 — viewer is Free', () => {
  it('may buy Mumate + as a first purchase, with nothing to carry', () => {
    expect(verdict('plus', freeViewer)).toEqual({ kind: 'buy', carriesDays: false, carryOverDays: 0 })
  })
  it('may buy Mumate Pro as a first purchase, with nothing to carry', () => {
    expect(verdict('pro', freeViewer)).toEqual({ kind: 'buy', carriesDays: false, carryOverDays: 0 })
  })
})

describe('#457 row 2 — viewer holds PLUS', () => {
  it('sees the Mumate + card as the package they already hold, WITH their real expiry', () => {
    expect(verdict('plus', plusUntil('2027-08-26'))).toEqual({ kind: 'current', expireAt: '2027-08-26' })
  })
  it('may upgrade to Mumate Pro, and the days they have left come with them', () => {
    const v = verdict('pro', plusUntil('2027-08-26'))
    expect(v.kind).toBe('upgrade')
    // 365 days from 2026-08-26 to 2027-08-26 — the number the door would carry (purchase-gate remainingDays)
    expect(v).toMatchObject({ carryOverDays: 365 })
  })
})

describe('#457 row 3 — viewer holds PRO', () => {
  it('cannot be sold Mumate + — that would take something away', () => {
    expect(verdict('plus', proUntil('2027-08-26'))).toEqual({ kind: 'blocked' })
  })
  it('sees the Mumate Pro card as the package they already hold', () => {
    expect(verdict('pro', proUntil('2027-01-15'))).toEqual({ kind: 'current', expireAt: '2027-01-15' })
  })
})

describe('#457 row 4 — 🔴 the row the ticket does not draw: we do NOT know yet', () => {
  it('renders neither branch while the membership is still loading', () => {
    expect(verdict('plus', null, false, TODAY, true)).toEqual({ kind: 'undetermined', because: 'loading' })
    expect(verdict('pro', null, false, TODAY, true)).toEqual({ kind: 'undetermined', because: 'loading' })
  })
  it('renders neither branch when the fetch settled with no membership row', () => {
    expect(verdict('plus', null)).toEqual({ kind: 'undetermined', because: 'unavailable' })
  })
  it('renders neither branch when isPaid itself is undetermined (null), even with a tier name present', () => {
    // 🔴 tier.ts:92 — isPaid null MUST come with tier null, but a screen must not depend on that holding.
    // If a name ever arrives beside a null verdict, this is the branch that must still refuse to guess.
    expect(verdict('plus', { isPaid: null, tier: 'PLUS', expireAt: '2027-08-26' })).toMatchObject({
      kind: 'undetermined',
    })
  })
  it('🔴 tells "still looking" apart from "we could not find out" — one null, two sentences', () => {
    // A settled-but-failed lookup that renders "กำลังตรวจสอบ…" makes our outage look like the user's wait.
    // The two must not collapse: this is the `T | null` carrying three meanings bug-class, one layer up.
    expect(verdict('plus', null, false, TODAY, true)).toMatchObject({ because: 'loading' })
    expect(verdict('plus', null, false, TODAY, false)).toMatchObject({ because: 'unavailable' })
  })
  it('does NOT read undetermined as a free first-time buyer', () => {
    // The failure this whole row exists to prevent, stated as its own assertion so MV1 cannot hide.
    expect(verdict('pro', null, false)).not.toMatchObject({ kind: 'buy' })
  })
})

describe('#457 row 5 — 🔴 the other undrawn row: paid, but no level name (legacy)', () => {
  it('may buy Mumate + — never refused, because we cannot place them on the ladder', () => {
    expect(verdict('plus', legacyUntil('2027-03-01'))).toMatchObject({ kind: 'buy', carriesDays: true })
  })
  it('may buy Mumate Pro on the same reasoning', () => {
    expect(verdict('pro', legacyUntil('2027-03-01'))).toMatchObject({ kind: 'buy', carriesDays: true })
  })
  it('🔴 is never called an UPGRADE — we do not know what they hold, so we cannot call anything higher', () => {
    expect(verdict('pro', legacyUntil('2027-03-01')).kind).not.toBe('upgrade')
  })
  it('🔴 is never shown "แพ็กปัจจุบัน" on any card — that word claims knowledge we do not have', () => {
    expect(verdict('plus', legacyUntil('2027-03-01')).kind).not.toBe('current')
    expect(verdict('pro', legacyUntil('2027-03-01')).kind).not.toBe('current')
  })
  it('still carries their remaining days (they lose nothing by being unnamed)', () => {
    expect(verdict('plus', legacyUntil('2026-09-05'))).toMatchObject({ carryOverDays: 10 })
  })
})

describe('#457 — a LAPSED member is not a member', () => {
  it('sees the Mumate + card as buyable again, NOT as "แพ็กปัจจุบัน"', () => {
    // The tier NAME is still on the row. Only isPaid answers paid-ness (tier.ts:22-24). A screen that read
    // the name would tell someone whose plan ran out that they still hold it.
    expect(verdict('plus', lapsedPlus)).toEqual({ kind: 'buy', carriesDays: false, carryOverDays: 0 })
  })
})

describe('#457 — the Free card is frozen by the ticket ("❌ ไม่แตะการ์ด Free")', () => {
  it('answers free-card for every viewer state, so no branch can start rendering into it', () => {
    for (const m of [freeViewer, plusUntil('2027-08-26'), proUntil('2027-08-26'), legacyUntil('2027-03-01'), null]) {
      expect(verdict('free', m)).toEqual({ kind: 'free-card' })
    }
    expect(verdict('free', null, false)).toEqual({ kind: 'free-card' })
  })
})

describe("#457 🔴 the reader's clock must not reach the words on the card", () => {
  it('gives the same verdict kind on two different days for the same viewer', () => {
    // mootech-fe#452 shipped a `.slice(0,10)` on an instant: a buyer at 02:30 saw the previous day's date.
    // `today` is needed to COUNT days, but no rendered branch may depend on it. Asserted, not promised.
    const m = plusUntil('2027-08-26')
    for (const card of ['plus', 'pro'] as const) {
      const a = cardVerdictFor({ planId: card, membership: m, determined: true, today: '2026-08-26' })
      const b = cardVerdictFor({ planId: card, membership: m, determined: true, today: '2027-08-25' })
      expect(a.kind).toBe(b.kind)
    }
  })
})

describe('#457 — negative controls (an assertion that reads back what it wrote proves nothing)', () => {
  it('the expiry on `current` tracks the INPUT — two different expiries give two different answers', () => {
    const a = verdict('plus', plusUntil('2027-08-26'))
    const b = verdict('plus', plusUntil('2028-01-02'))
    expect(a).toEqual({ kind: 'current', expireAt: '2027-08-26' })
    expect(b).toEqual({ kind: 'current', expireAt: '2028-01-02' })
    expect(a).not.toEqual(b)
  })
  it('the carried day count tracks the INPUT — a longer remaining term carries more days', () => {
    const near = verdict('pro', plusUntil('2026-09-01'))
    const far = verdict('pro', plusUntil('2027-08-26'))
    expect(near).toMatchObject({ carryOverDays: 6 })
    expect(far).toMatchObject({ carryOverDays: 365 })
  })
})

describe('#457 🔴 a logged-out visitor must keep the buy button they have today', () => {
  // This is the regression the screen's TWO-HOOK arrangement exists to prevent, and it is asserted through
  // the REAL seam rather than a mock: computeTier is what tells "anonymous" (KNOWN not-paid) apart from
  // identity-limbo and a failed fetch. Deriving `determined` from `membership == null` instead — the
  // obvious one-hook shortcut — collapses all three and would hide the shop's buttons from every visitor
  // who is not logged in. A mount test cannot catch that: it mocks the very hook that makes the call.
  const anon = computeTier({ status: 'anon', userId: '', done: true, errored: false, user: null })

  it('computeTier calls an anonymous visitor KNOWN not-paid, not unknown', () => {
    expect(anon.isPaid).toBe(false)
  })
  it('so both paid cards are buyable for them', () => {
    for (const card of ['plus', 'pro'] as const) {
      expect(
        cardVerdictFor({
          planId: card,
          determined: anon.isPaid != null,
          loading: anon.loading,
          membership: { isPaid: anon.isPaid, tier: anon.tier, expireAt: null },
          today: TODAY,
        }),
      ).toEqual({ kind: 'buy', carriesDays: false, carryOverDays: 0 })
    }
  })
  it('while identity-limbo (authed, member id not resolved) stays undetermined — NOT a free buyer', () => {
    const limbo = computeTier({ status: 'loading', userId: '', done: false, errored: false, user: null })
    expect(limbo.isPaid).toBeNull()
    expect(
      cardVerdictFor({
        planId: 'plus',
        determined: limbo.isPaid != null,
        loading: limbo.loading,
        membership: null,
        today: TODAY,
      }),
    ).toEqual({ kind: 'undetermined', because: 'loading' })
  })
})

describe('#358 Phase 1 🔴 the REAL resolver output, through the screen own mapping', () => {
  // 🔴 THE GAP THIS BLOCK CLOSES. Every other row in this file is an object literal: it asserts what
  // `cardVerdictFor` does with a shape a HUMAN typed. #358 Phase 1 changed the shape the SERVER produces —
  // a valid legacy member went from `{ isPaid: true, tier: null }` to `{ isPaid: true, tier: 'PRO' }` — and
  // no literal moved, so `npm test` stayed green (1060 passed) while the shop stopped selling to the ~17
  // people the phase was for. So nothing below is typed by hand: the fixture is a member_payment ROW, and
  // every shape after it is produced by the real functions the request path uses, in the same order:
  //
  //   member_payment row → classifyMembership (usage-core.ts:90, what pages/api/user.ts:88 calls)
  //                      → resolveMembershipFromRows (subscription.ts:169, what pages/api/user.ts:86 calls)
  //                      → computeTier (tier.ts:41, what useV2Tier gives ShopScreen)
  //                      → the ShopScreen.tsx:59-71 mapping
  //                      → cardVerdictFor
  //
  // ⚠️ WHAT IT STILL DOES NOT COVER: the mapping step is REPRODUCED here, not imported — ShopScreen builds
  // that object inline in a component. Reverting ShopScreen.tsx alone (dropping `source` again) leaves this
  // block green; scripts/shop-screen-mount.test.tsx row 5 is what reddens for that half.
  const LEGACY_ROW = { planCode: MEMBER_PLAN, expireAt: '2027-03-01' }
  const NOW = new Date('2026-08-26T05:00:00Z') // 12:00 in Bangkok on TODAY — same day either way
  const V2_ROW = { id: 'sub-1', tierCode: 'PRO', status: 'ACTIVE', expireAt: '2027-06-30', createdAt: '2026-03-01T00:00:00.000Z' }

  // pages/api/user.ts:86-100, verbatim in structure: the legacy half classified from the member_payment row
  // the route already holds, with that row's expiry riding along.
  const serverAnswerFor = (rows: typeof V2_ROW[], row: typeof LEGACY_ROW | null) =>
    resolveMembershipFromRows(rows, TODAY, {
      ...classifyMembership(row, NOW),
      expireAt: row?.expireAt ?? null,
    })

  // ShopScreen.tsx:59-71 — the two hooks it reads, and the ViewerMembership it rebuilds from them.
  const asTheShopScreenSeesIt = (server: ReturnType<typeof serverAnswerFor>, memberPaymentExpireAt: string | null) => {
    const t = computeTier({
      status: 'authed',
      userId: 'u-358',
      done: true,
      errored: false,
      user: { payment: { is_not_expired: isNotExpired(memberPaymentExpireAt, NOW) }, membership: server },
    })
    const membership: ViewerMembership =
      t.isPaid == null
        ? null
        : { isPaid: t.isPaid, tier: t.tier, source: server.source ?? null, expireAt: server.expireAt ?? null }
    return (planId: 'plus' | 'pro') =>
      cardVerdictFor({ planId, determined: t.isPaid != null, loading: t.loading, membership, today: TODAY })
  }

  const legacyCard = asTheShopScreenSeesIt(serverAnswerFor([], LEGACY_ROW), LEGACY_ROW.expireAt)

  it('the resolver really does hand this member a DECIDED name — the premise, stated so a revert is visible', () => {
    // If #358 Phase 1 is ever rolled back this is the one test that says so by name, instead of the buy
    // tests below quietly passing for the old reason and hiding that the phase is gone.
    expect(serverAnswerFor([], LEGACY_ROW)).toEqual({
      isPaid: true,
      tier: 'PRO',
      source: 'legacy',
      expireAt: '2027-03-01',
    })
  })

  it('🔴 and BOTH paid cards still offer a purchase — this is the regression', () => {
    // Before the fix: pro → { kind: 'current' }, plus → { kind: 'blocked' }. PackageCard.tsx:184-195 and
    // :196-204 render no control for either, so the member could buy nothing at all.
    expect(legacyCard('pro').kind).toBe('buy')
    expect(legacyCard('plus').kind).toBe('buy')
  })

  it('carries their remaining days onto whichever package they choose', () => {
    // 2026-08-26 → 2027-03-01 = 187 days, the same count the door would carry (purchase-gate remainingDays).
    expect(legacyCard('pro')).toEqual({ kind: 'buy', carriesDays: true, carryOverDays: 187 })
    expect(legacyCard('plus')).toEqual({ kind: 'buy', carriesDays: true, carryOverDays: 187 })
  })

  it('is still never called an UPGRADE — the decided name is not a level we can rank them on', () => {
    expect(legacyCard('pro').kind).not.toBe('upgrade')
    expect(legacyCard('plus').kind).not.toBe('upgrade')
  })

  it('🔴 NEGATIVE CONTROL — a real v2 PRO member is still refused on both cards', () => {
    // Without this, "everyone can buy" would pass the block above just as well, and the fix would read as
    // "the gate was switched off". The two members reach `cardVerdictFor` with the SAME tier name 'PRO';
    // only `source` differs, and that difference is the whole rule.
    //
    // 🔴 THE V2 MEMBER CARRIES A member_payment ROW TOO, and that is not fixture convenience — it is the
    // only shape that exists. computeTier reads the paid verdict from `payment.is_not_expired`
    // (tier.ts:22-24 isPaidMember), which is member_payment, NOT the v2 composite; a v2 row alone reads as
    // NOT PAID all the way through this screen. Prod never has that shape because settlement keeps the
    // member_payment shadow in step (lib/payment/repo.ts:210). Written down because building this control
    // with `null` here produced `kind: 'buy'` and looked exactly like the fix failing.
    // The two expiries differ on purpose: the answer must come from the v2 row, not from the shadow.
    const v2Server = serverAnswerFor([V2_ROW], LEGACY_ROW)
    const v2Card = asTheShopScreenSeesIt(v2Server, LEGACY_ROW.expireAt)
    expect(v2Server).toEqual({ isPaid: true, tier: 'PRO', source: 'v2', expireAt: '2027-06-30' })
    expect(v2Card('pro')).toEqual({ kind: 'current', expireAt: '2027-06-30' })
    expect(v2Card('plus')).toEqual({ kind: 'blocked' })
  })
})

describe('#358 Phase 1 — the pre-#358 legacy shape (paid, no name at all) still buys', () => {
  // The branch legacyUntil now leans on, kept asserted in its own right: purchase-gate has no way to place
  // an unnamed paid member either, and must not start refusing them if a source is ever missing.
  it('may buy either package and is never refused', () => {
    expect(verdict('plus', unnamedLegacyUntil('2027-03-01'))).toMatchObject({ kind: 'buy', carriesDays: true })
    expect(verdict('pro', unnamedLegacyUntil('2027-03-01'))).toMatchObject({ kind: 'buy', carriesDays: true })
  })
})
