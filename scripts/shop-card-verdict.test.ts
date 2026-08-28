// #457 — teeth for what ONE package card says to THIS viewer. PURE, main lane (npm test).
//
// The DoD says "ทั้ง 3 แถวในเมทริกซ์แสดงถูก — พิสูจน์ทีละแถว", so every viewer state gets its OWN `it`
// per card. A combined table-driven assertion would let one row rot green behind the others, and the row
// most likely to rot is the one nobody drew: `undetermined`.
//
// 🔴 THE MATRIX IS 5 ROWS, NOT 3. The ticket draws Free / PLUS / PRO. The two it does not draw are the two
// that fail silently: `undetermined` (loading or error — guessing either way is wrong, tier.ts:35-39) and
// the legacy member (paid, no level name — lib/v2/tier.ts:114). Both are asserted here.
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
import { describe, it, expect } from 'vitest'
import { cardVerdictFor, type ViewerMembership } from '@/features/v2-shop/card-verdict'
import { computeTier } from '@/lib/v2/tier'

const TODAY = '2026-08-26'

// Each helper reads as the matrix ROW it is, not as an object literal.
const freeViewer: ViewerMembership = { isPaid: false, tier: null, expireAt: null }
const plusUntil = (expireAt: string): ViewerMembership => ({ isPaid: true, tier: 'PLUS', expireAt })
const proUntil = (expireAt: string): ViewerMembership => ({ isPaid: true, tier: 'PRO', expireAt })
// paid, but their row predates the tier catalogue ⇒ no level NAME (purchase-gate.ts legacy branch)
const legacyUntil = (expireAt: string): ViewerMembership => ({ isPaid: true, tier: null, expireAt })
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
