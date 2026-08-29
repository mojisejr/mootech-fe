// #466 — the half of mootech-fe#456's door that had NO test: the database read.
//
// 🔴 WHAT WAS MISSING AND WHY IT MATTERED. scripts/payment-charge-route.test.ts mocks `decidePurchaseFor`
// wholesale (its vi.mock of '@/lib/payment/repo' supplies a fake), so everything it proves has the shape
// "IF the gate is told to refuse, THEN nothing is reserved and no charge is created". Nothing anywhere
// proved the antecedent: that the gate, handed a real user who really holds PLUS in a real database,
// actually decides to refuse. ฟีม asked exactly that question on the day #456 shipped — "ผมเป็น plus
// แล้วผมเข้าไปใน package ยังกดซื้อได้อยู่" — and the honest answer was that we had read the code and run
// the pure tests, not that we had watched it happen.
//
// The two halves either side of it were tested: decidePurchase (pure, scripts/payment-purchase-gate.test.ts)
// and readEntitlement (exercised through settleAndProvision, scripts/payment-webhook-db.test.ts). This
// covers the composition — the thing the route actually calls.
//
// Run:  TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5433/mumate_test \
//       DATABASE_URL=postgres://postgres:postgres@localhost:5433/mumate_test \
//       npx vitest run scripts/purchase-gate-db.test.ts
//
// 🔴 MUTANT CONTRACT (each reddens this file):
//   PD1  readEntitlement stops seeing live member_subscription rows   → every "holds PLUS" test reddens
//   PD2  the gate allows same-tier repurchase                          → ① reddens
//   PD3  the gate allows a downgrade                                   → ② reddens
//   PD4  an EXPIRED row is treated as live                             → ④ reddens
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import postgres from 'postgres'
import { decidePurchaseFor, readEntitlement } from '@/lib/payment/repo'
import { resolveSubscription } from '@/lib/v2/subscription'
import { cardVerdictFor } from '@/features/v2-shop/card-verdict'
import type { PlanId } from '@/features/v2-shop/packages'

const TEST_URL = process.env.TEST_DATABASE_URL
const M0006 = readFileSync(resolve('lib/db/0006_member_subscription.sql'), 'utf8')
const NOW = new Date()
const bkk = (n: Date) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' }).format(n)
const addDaysStr = (ymd: string, n: number) => {
  const [y, m, d] = ymd.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1, d + n))
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(t.getUTCDate()).padStart(2, '0')}`
}

describe.skipIf(!TEST_URL)('#466 the purchase gate against real postgres', () => {
  let sql: ReturnType<typeof postgres>
  let users: string[]
  const today = bkk(NOW)

  beforeAll(async () => {
    sql = postgres(TEST_URL as string, { max: 4, ssl: false })
    await sql.unsafe(M0006) // idempotent
    // Users with NO member_payment row, so the legacy fallback cannot quietly make someone "paid".
    const rows = await sql`SELECT user_id FROM "user"
      WHERE user_id NOT IN (SELECT user_id FROM member_payment) LIMIT 2`
    users = rows.map((r) => r.user_id as string)
    expect(users.length, 'the test database must have spare users').toBeGreaterThan(0)
  })

  afterAll(async () => {
    if (sql) {
      await sql`DELETE FROM member_subscription WHERE user_id = ANY(${users})`
      await sql.end()
    }
  })
  afterEach(async () => {
    await sql`DELETE FROM member_subscription WHERE user_id = ANY(${users})`
  })

  const seed = (id: string, userId: string, tier: string, expireAt: string, status = 'ACTIVE') =>
    sql`INSERT INTO member_subscription (id, user_id, tier_code, package_code, amount_satang, start_at, expire_at, status)
        VALUES (${id}, ${userId}, ${tier}, ${'PKG-' + tier}, 79000, ${today}, ${expireAt}, ${status})`

  it('PD1 — the read sees a live PLUS row and names it', async () => {
    await seed('pd-1', users[0], 'PLUS', addDaysStr(today, 100))
    const held = await readEntitlement(users[0], NOW)
    expect(held.isPaid).toBe(true)
    expect(held.tier).toBe('PLUS')
    expect(held.expireAt).toBe(addDaysStr(today, 100))
  })

  it('🔴 ① ฟีม’s case: a PLUS member buying PLUS is REFUSED — the antecedent the route test assumed', async () => {
    await seed('pd-2', users[0], 'PLUS', addDaysStr(today, 100))
    const d = await decidePurchaseFor(users[0], 'PLUS', NOW)
    expect(d).toEqual({ allow: false, reason: 'ALREADY_ON_THIS_TIER' })
  })

  it('② a PRO member buying PLUS is REFUSED as a downgrade', async () => {
    await seed('pd-3', users[0], 'PRO', addDaysStr(today, 100))
    const d = await decidePurchaseFor(users[0], 'PLUS', NOW)
    expect(d).toEqual({ allow: false, reason: 'CANNOT_DOWNGRADE' })
  })

  it('③ CONTROL — the same PLUS member buying PRO is ALLOWED, carrying the 100 days', async () => {
    await seed('pd-4', users[0], 'PLUS', addDaysStr(today, 100))
    const d = await decidePurchaseFor(users[0], 'PRO', NOW)
    expect(d).toEqual({ allow: true, carryOverDays: 100 })
  })

  it('④ PD4 — an EXPIRED row is not a membership: they buy again like anyone else', async () => {
    await seed('pd-5', users[0], 'PLUS', addDaysStr(today, -1)) // yesterday
    const d = await decidePurchaseFor(users[0], 'PLUS', NOW)
    expect(d).toEqual({ allow: true, carryOverDays: 0 })
  })

  it('⑤ CONTROL — a user holding nothing at all is allowed, so a refusal means something', async () => {
    const d = await decidePurchaseFor(users[0], 'PLUS', NOW)
    expect(d).toEqual({ allow: true, carryOverDays: 0 })
    const held = await readEntitlement(users[0], NOW)
    expect(held.isPaid).toBe(false)
    expect(held.tier).toBeNull()
  })

  it('⑥ the refusal is per-USER — another account is unaffected by this one’s membership', async () => {
    await seed('pd-6', users[0], 'PLUS', addDaysStr(today, 100))
    expect(await decidePurchaseFor(users[0], 'PLUS', NOW)).toEqual({ allow: false, reason: 'ALREADY_ON_THIS_TIER' })
    if (users[1]) {
      expect(await decidePurchaseFor(users[1], 'PLUS', NOW)).toEqual({ allow: true, carryOverDays: 0 })
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────────────────────────────────────
// #518 — the door and the screen, bound for ONE legacy member.
//
// 🔴 WHAT THIS CLOSES. #358 Phase 1 left a sentence in the comments saying that the two feeders both null
// the tier for a legacy member, so both let them buy. That sentence is BEHAVIOUR, and nothing held it:
// `readEntitlement` (the door, lib/payment/repo.ts:458) and `cardVerdictFor` (the screen,
// features/v2-shop/card-verdict.ts:71) reach it by different routes and could drift apart silently.
// mootech-fe#514 is the same pair already disagreeing on a different input, so the drift is not theoretical.
//
// The screen is driven through `resolveSubscription` rather than a hand-built object on purpose: that is
// where the screen's membership actually comes from (ShopScreen.tsx:64-71 assembles it from the composite
// that useV2Tier and /api/user share). Hand-building it would test the fixture, not the pair.
//
// 🔴 MUTANT CONTRACT — fired 2026-08-29, each on the full file. Two columns, because "the block reddens"
// and "the BINDING reddens" are different claims and only the second one is what this file is for.
//
//   mutant                                                        block   binding line
//   MD2  repo.ts legacy branch returns tier: 'PRO' — the door is
//        handed the DECIDED name, the mirror of the Phase 1b bug   DIED    YES  door allowed=false,
//                                                                                screen answered buy
//   MS   card-verdict.ts:111 drops `source === 'legacy'` and
//        passes the decided name through (the Phase 1b bug itself) DIED    YES  door allowed=true,
//                                                                                screen answered blocked
//   MD   repo.ts legacy branch returns isPaid: false               DIED    NO   absorbed by the
//                                                                                descriptive assertion
//   MC   pickActiveSubscriptionRow never returns a row             DIED    ②, 6 tests — control has teeth
//
// 🔴 MD is reported as it behaved, not as I first predicted. It does not move the PLACEMENT: a not-paid
// user may still buy, so both sides keep allowing and the binding stays green. It is killed by this block,
// by the assertion below that names it — a real kill of the file, and NOT evidence for the binding.
// A door-side mutant that the binding does catch has to change the placement, which is MD2.
describe.skipIf(!TEST_URL)('#518 the door and the screen agree about a legacy member', () => {
  let sql: ReturnType<typeof postgres>
  let legacyUser: string
  const today = bkk(NOW)

  beforeAll(async () => {
    sql = postgres(TEST_URL as string, { max: 4, ssl: false })
    await sql.unsafe(M0006) // idempotent
    const rows = await sql`SELECT user_id FROM "user"
      WHERE user_id NOT IN (SELECT user_id FROM member_payment)
        AND user_id NOT IN (SELECT user_id FROM member_subscription) LIMIT 1`
    expect(rows.length, 'the test database must have a user holding neither table').toBe(1)
    legacyUser = rows[0].user_id as string
    // A valid legacy membership: a member_payment row and NO member_subscription row. This is the exact
    // state of the 2 MANUAL_VIP accounts on prod that Phase 1 exists for (harness/457-capture-rows.mjs:35).
    await sql`INSERT INTO member_payment (user_id, plan_code, package_code, create_at, start_at, expire_at)
              VALUES (${legacyUser}, 'MEMBER', 'MANUAL_VIP', ${today}, ${today}, ${addDaysStr(today, 100)})`
  })

  afterAll(async () => {
    if (sql) {
      await sql`DELETE FROM member_subscription WHERE user_id = ${legacyUser}`
      await sql`DELETE FROM member_payment WHERE user_id = ${legacyUser}`
      await sql.end()
    }
  })
  afterEach(async () => {
    await sql`DELETE FROM member_subscription WHERE user_id = ${legacyUser}`
  })

  /** The screen's answer for one card, fed from the same place the real screen is fed from. */
  const screenSays = async (planId: PlanId) =>
    cardVerdictFor({
      planId,
      determined: true,
      loading: false,
      membership: await resolveSubscription(legacyUser, NOW),
      today,
    })

  /** The door's answer for one card. `null` is the free card, which never reaches checkout. */
  const doorSays = async (planId: PlanId) => {
    const target = ({ free: null, plus: 'PLUS', pro: 'PRO' } as const)[planId]
    if (target === null) return null
    return decidePurchaseFor(legacyUser, target, NOW)
  }

  /** THE BINDING. One boolean per side, from the two independent readers, for the same person and card. */
  const bothAllow = async (planId: PlanId) => {
    const door = await doorSays(planId)
    const screen = await screenSays(planId)
    return {
      door: door?.allow === true,
      screen: screen.kind === 'buy' || screen.kind === 'upgrade',
      screenKind: screen.kind,
    }
  }

  it('🔴 ① a valid legacy member — the door and the screen BOTH allow both paid cards', async () => {
    // 🔴 THE BINDING GOES FIRST, and the order is load-bearing. vitest stops a test at its first failing
    // expect, so any assertion placed above this one would ABSORB a one-sided mutant and report itself
    // instead — the binding would then be green in every run that could ever have reddened it. Measured:
    // with the descriptive assertions first, mutant MD died on `the door sees a paid member` and the
    // binding line was never reached.
    for (const planId of ['plus', 'pro'] as const) {
      const { door, screen, screenKind } = await bothAllow(planId)
      expect(screen, `the ${planId} card: door allowed=${door}, screen answered ${screenKind}`).toBe(door)
      expect(door, `the ${planId} card must be buyable by a legacy member`).toBe(true)
    }

    // Why the two of them CAN drift: they disagree about the NAME on purpose, and only the placement is
    // bound above. Kept as documentation of the state the binding holds, not as the binding itself.
    const held = await readEntitlement(legacyUser, NOW)
    expect(held.isPaid, 'the door sees a paid member').toBe(true)
    expect(held.tier, 'the door has no level it can PROVE they hold').toBeNull()

    const shown = await resolveSubscription(legacyUser, NOW)
    expect(shown.isPaid).toBe(true)
    expect(shown.source, 'the screen is told the name was DECIDED, not read').toBe('legacy')
    expect(shown.tier, 'and the decided name is PRO (subscription.ts:26)').toBe('PRO')
  })

  it('② NEGATIVE CONTROL — a live v2 PRO row is PLACED, and both sides refuse the PRO card together', async () => {
    await sql`INSERT INTO member_subscription
              (id, user_id, tier_code, package_code, amount_satang, start_at, expire_at, status)
              VALUES ('bind-518', ${legacyUser}, 'PRO', 'PKG-PRO', 159000, ${today}, ${addDaysStr(today, 100)}, 'ACTIVE')`

    const shown = await resolveSubscription(legacyUser, NOW)
    expect(shown.source, 'the live v2 row wins over the legacy shadow').toBe('v2')

    const pro = await bothAllow('pro')
    expect(pro.screen).toBe(pro.door)
    expect(pro.door, 'a placed PRO member cannot buy PRO again').toBe(false)
    expect(pro.screenKind, 'and the card says they already hold it').toBe('current')

    // The control earns its name here: ① and ② give OPPOSITE answers for the same user and the same card,
    // separated only by the presence of the v2 row. A comparator that agreed with itself no matter what
    // would pass ① and fail this line.
    const plus = await bothAllow('plus')
    expect(plus.screen).toBe(plus.door)
    expect(plus.door, 'and PLUS is a downgrade for them').toBe(false)
  })
})
