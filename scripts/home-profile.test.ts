// ANCHOR: show-upgrade-rule-c — the v2 home upgrade badge (กติกา ค, ฟีมเคาะ) must HIDE only for a paid
// member whose plan is still valid (payment.is_not_expired === true); free / expired / no-payment / no-user
// all SHOW it — identical to v1 header-v2.tsx so the two versions never disagree about paid status.
//
// #383 — MOVED FROM THE tsx LANE ONTO vitest (registered in vitest.config.mts), the opportunistic
// migration #210 asks for whenever a spec is being edited anyway. Same assertions, vitest syntax.
// ⚠️ NOT because the tsx lane is dead — I wrote that reason first and it was WRONG: #334 moved that lane
// into .githooks/pre-push, where it ran 73 files on the push that carried this commit. It derives its skip
// list from vitest.config.mts, so registering this file there is what keeps it from being run TWICE.
//
// SECOND bug-class this now owns (μุน's finding, #383 DoD 🔴): home's contract was a plain boolean, so
// "we do not know yet" collapsed into "not paid" — a paying member saw the badge whenever /api/user
// errored. `isPaid`/`tier` are tri-state; `showUpgrade` deliberately keeps the old 2-value collapse until
// #384 switches the screen over.
//
// 🔴 MUTANT CONTRACT (each reddens `npm test`):
//   M1  deriveHomeProfile ignores `state` and always reports determined  → the loading/errored cases red
//   M2  `isPaid` is derived from membership.isPaid instead of the legacy flag (precedence flipped)
//                                                                        → the legacy-member case red
//   M3  the name skips resolveDisplayTier (raw parseTierCode)            → the paid+FREE case red
//   M4  showUpgrade's rule loosened from strict === true                 → the truthy neg-control red
import { describe, it, expect } from 'vitest'
import { deriveHomeProfile } from '../lib/home/profile'

// The fetch settled with a usable row — the state every pre-#383 assertion implicitly assumed.
const SETTLED = { done: true, errored: false }

describe('deriveHomeProfile — กติกา ค upgrade badge (unchanged by #383)', () => {
  it('paid + still valid (is_not_expired===true) → HIDE badge', () => {
    expect(deriveHomeProfile({ payment: { is_not_expired: true } }, SETTLED).isPaid).toBe(true)
  })
  it('free (no payment row) → SHOW badge', () => {
    expect(deriveHomeProfile({ payment: null }, SETTLED).isPaid).toBe(false)
  })
  it('expired (is_not_expired===false) → SHOW badge', () => {
    expect(deriveHomeProfile({ payment: { is_not_expired: false } }, SETTLED).isPaid).toBe(false)
  })
  it('no user yet → SHOW badge (safe default)', () => {
    // 🔴 #384 CHANGED WHAT THIS CASE SAYS, and the change IS the bug fix. It used to read "no row ⇒ show
    //    the upsell". A settled fetch with no row means WE COULD NOT TELL, and the answer is now `null`:
    //    the header draws nothing rather than telling a member who paid to upgrade.
    expect(deriveHomeProfile(null, SETTLED).isPaid).toBeNull()
  })
  // neg-control: a truthy-but-not-true value must NOT hide the badge. If the rule were `!(is_not_expired)`
  // (truthy) instead of strict `=== true`, this would wrongly hide it — proving the strict comparison.
  it('strict ===true: a truthy non-boolean (1) must NOT hide the badge', () => {
    expect(deriveHomeProfile({ payment: { is_not_expired: 1 as unknown as boolean } }, SETTLED).isPaid).toBe(false)
  })
  it('avatar: real picture_url kept', () => {
    expect(deriveHomeProfile({ picture_url: 'https://x/p.jpg' }, SETTLED).pictureUrl).toBe('https://x/p.jpg')
  })
  it('avatar: empty/whitespace picture_url → null (Lamun draws the letter tile)', () => {
    expect(deriveHomeProfile({ picture_url: '' }, SETTLED).pictureUrl).toBe(null)
    expect(deriveHomeProfile({ picture_url: null }, SETTLED).pictureUrl).toBe(null)
  })
})

describe('#383 deriveHomeProfile — home can finally say "NOT DETERMINED"', () => {
  const PAID_PRO = { payment: { is_not_expired: true }, membership: { tier: 'PRO' } }

  // 🔴 The exact case μุน reproduced: /api/user errors ⇒ settled with no row. Before #383 home had only a
  // boolean and answered "not paid". Now the tri-state says "unknown" and #384 makes the screen honour it.
  it('🔴 settled with an ERROR → isPaid null + tier null (NOT false, NOT FREE)', () => {
    const p = deriveHomeProfile(null, { done: true, errored: true })
    expect(p.isPaid).toBe(null)
    expect(p.tier).toBe(null)
  })
  it('🔴 fetch still in flight → isPaid null + tier null, even with a row already in hand', () => {
    const p = deriveHomeProfile(PAID_PRO, { done: false, errored: false })
    expect(p.isPaid).toBe(null)
    expect(p.tier).toBe(null)
  })
  it('settled, no row at all → isPaid null (cannot be "free": we never saw the account)', () => {
    expect(deriveHomeProfile(null, SETTLED).isPaid).toBe(null)
  })
  // The 2-value view is UNCHANGED on purpose (#384 owns the switch): unknown still collapses to "show".
  it('#384 — the 2-value collapse is GONE: unknown is null in every not-determined shape', () => {
    // Was: "showUpgrade keeps the old collapse while unknown (pixels do not move in this PR)". #383 kept the
    // collapse alive on purpose so this screen could switch in one PR instead of two; #384 is that switch, so
    // the field and its collapse leave together. Deleting the case would have deleted the fact — it is
    // rewritten against the survivor instead.
    expect(deriveHomeProfile(null, { done: true, errored: true }).isPaid).toBeNull()
    expect(deriveHomeProfile(PAID_PRO, { done: false, errored: false }).isPaid).toBeNull()
  })
})

describe('#383 deriveHomeProfile — the named tier, reconciled', () => {
  it('v2 member → the name reaches the screen', () => {
    expect(deriveHomeProfile({ payment: { is_not_expired: true }, membership: { tier: 'PRO' } }, SETTLED).tier).toBe('PRO')
    expect(deriveHomeProfile({ payment: { is_not_expired: true }, membership: { tier: 'PLUS' } }, SETTLED).tier).toBe('PLUS')
  })
  // 🔴 The state EVERY member who pays today is in: paid through member_payment, no v2 row, no name.
  // The badge says "สมาชิก" (#384). Reading this as free is the money bug.
  it('🔴 legacy member (no membership key) → isPaid TRUE, tier null — never FREE, never "not paid"', () => {
    const p = deriveHomeProfile({ payment: { is_not_expired: true } }, SETTLED)
    expect(p.isPaid).toBe(true)
    expect(p.tier).toBe(null)
    expect(p.isPaid).toBe(true)
  })
  it('membership null (server could not determine it) → tier null, paid verdict untouched', () => {
    const p = deriveHomeProfile({ payment: { is_not_expired: true }, membership: null }, SETTLED)
    expect(p.isPaid).toBe(true)
    expect(p.tier).toBe(null)
  })
  // M3 / precedence: a name that contradicts the paid verdict is dropped, the access is not.
  it('🔴 paid + a row saying FREE → tier null, isPaid stays TRUE (the pair true+FREE never ships)', () => {
    const p = deriveHomeProfile({ payment: { is_not_expired: true }, membership: { tier: 'FREE' } }, SETTLED)
    expect(p.isPaid).toBe(true)
    expect(p.tier).toBe(null)
  })
  it('unrecognised tier_code → tier null (allow-list, never coerced)', () => {
    expect(deriveHomeProfile({ payment: { is_not_expired: true }, membership: { tier: 'PLATINUM' } }, SETTLED).tier).toBe(null)
  })
  it('free user → isPaid false, no name invented', () => {
    const p = deriveHomeProfile({ payment: { is_not_expired: false } }, SETTLED)
    expect(p.isPaid).toBe(false)
    expect(p.tier).toBe(null)
  })
})
