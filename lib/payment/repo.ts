// v2 payment I/O (mootech-fe#355) — the ONLY layer that touches the DB. The decision logic is pure
// (catalog/provision); this file reads/writes and owns the ATOMIC settlement.
import { and, eq, ne, gte, desc, sql, inArray } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import { db as defaultDb } from '@/lib/db'
import { v2Payment, memberPayment, memberSubscription, paymentPackage, paymentQuote, user } from '@/lib/db/schema'
import { parseExpireSpec, type PackageRow } from './catalog'
import { buildProvision } from './provision'
import { decidePurchase, decideSettlement, type Entitlement, type PurchaseDecision } from './purchase-gate'
import { toSubRows, pickActiveSubscriptionRow } from '@/lib/v2/subscription'
import { classifyMembership, bkkDateStr } from '@/lib/usage-core'
import { parseTierCode, tierRank } from '@/lib/v2/tier'
import { reserveCodeInTx, releaseRedemption, restoreRedemption, Refuse } from '@/lib/discount/repo'
import type { TierCode } from '@/lib/v2/tier'

type Db = typeof defaultDb

// #484 — the one value this lane writes. Named once so the webhook, the screen contract and the tests
// cannot drift into three spellings of the same fact.
//
// 🔴 IT HAS A SECOND PRODUCER, so nothing may branch on this code ALONE (lamun caught the screen doing
// exactly that). reconcile-run.ts:105 builds `gateway_${charge.status}` and reaches the same string, but
// it goes through abandonByChargeId, which returns at repo.ts:173 when the row is APPROVED. So:
//   REJECT   + gateway_reversed → reversed before anything was ever granted   (the reconciler wrote it)
//   APPROVED + gateway_reversed → granted, then taken back                     (this lane wrote it)
// A reader that wants the second one must ask for `status === 'APPROVED'` too, or it will tell a user
// their entitlement was revoked when they never had one.
export const REVERSED_CODE = 'gateway_reversed'

// #484 — captured on a payment when the user had NO member_payment row at settle time. Distinct from NULL,
// which means no writer had run yet. '' is a measurement ("there was nothing"); NULL is ignorance.
export const NO_SHADOW = ''

// Civil timestamp 'YYYY-MM-DD HH:mm:ss' in Asia/Bangkok (member_payment.create_at parity with v1's moment).
function bkkTimestamp(now: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(now)
  const p = (t: string) => parts.find((x) => x.type === t)?.value ?? '00'
  return `${p('year')}-${p('month')}-${p('day')} ${p('hour')}:${p('minute')}:${p('second')}`
}
function bkkDate(now: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}

export async function getPackage(code: string, db: Db = defaultDb): Promise<PackageRow | null> {
  const rows = await db
    .select()
    .from(paymentPackage)
    .where(eq(paymentPackage.packageCode, code))
    .orderBy(paymentPackage.id)
    .limit(1)
  const row = rows[0]
  if (!row) return null
  return {
    packageCode: row.packageCode,
    planCode: row.planCode,
    amount: Number(row.amount),
    expire: row.expire,
    bufferDay: Number(row.bufferDay),
    tierCode: row.tierCode, // #377 — the level comes from the DB row now
    isActive: row.isActive,
  }
}

export async function getUserEmail(userId: string, db: Db = defaultDb): Promise<string | null> {
  const [row] = await db.select({ email: user.email }).from(user).where(eq(user.userId, userId)).limit(1)
  return row?.email ?? null
}

export async function insertPending(
  row: {
    userId: string
    packageCode: string
    tierCode: string
    amountSatang: number
    vatSatang: number
    expire: string // frozen at charge (ตู๋ #370 B2)
    bufferDay: number
    method: 'card' | 'promptpay'
    chargeId: string
    orderId: string
  },
  db: Db = defaultDb,
): Promise<string> {
  const id = randomUUID()
  await db.insert(v2Payment).values({ id, status: 'PENDING', ...row })
  return id
}

// 🔴 #361 — RESERVE BEFORE MONEY. A discount code's quota must be refused BEFORE the card is charged, so
// the v2_payment row and the discount reservation are written in ONE transaction that runs first; the real
// charge_id is attached afterwards (attachChargeId) once Omise accepts.
//
// Why a placeholder charge_id: v2_payment.charge_id is NOT NULL + UNIQUE (it is #355's settlement key), but
// at reserve time Omise has not issued one yet. `pending:<id>` is unique per row and can never collide with
// a real Omise id (those are `chrg_…`), so a webhook can never match a not-yet-charged row.
//
// Failure paths: a refusal (FULL/PER_USER) rolls the whole txn back — no v2_payment row, used_count intact.
// If the CHARGE then fails, the caller calls abandonPending() to release the reservation and mark the row.
export function placeholderChargeId(paymentId: string): string {
  return `pending:${paymentId}`
}

export async function insertPendingReserved(
  row: {
    userId: string
    packageCode: string
    tierCode: string
    amountSatang: number
    vatSatang: number
    expire: string
    bufferDay: number
    method: 'card' | 'promptpay'
    orderId: string
    quoteId: string | null
    discountSatang: number
    codeId: string | null
  },
  reserve: null | { codeId: string; vatPercent: number; maxUsePerUser: number | null },
  db: Db = defaultDb,
): Promise<{ ok: true; paymentId: string } | { ok: false; reason: 'FULL' | 'PER_USER' }> {
  const id = randomUUID()
  try {
    await db.transaction(async (tx) => {
      await tx.insert(v2Payment).values({
        id,
        status: 'PENDING',
        chargeId: placeholderChargeId(id),
        ...row,
      })
      if (reserve) {
        await reserveCodeInTx(tx as never, {
          codeId: reserve.codeId,
          userId: row.userId,
          paymentId: id,
          discountSatang: row.discountSatang,
          vatPercent: reserve.vatPercent,
          maxUsePerUser: reserve.maxUsePerUser,
        })
      }
    })
    return { ok: true, paymentId: id }
  } catch (e) {
    if (e instanceof Refuse) return { ok: false, reason: e.reason }
    throw e
  }
}

// 🔴 Layer 2 (ตู๋ #372 ③): a webhook saying the charge FAILED/EXPIRED/REVERSED frees the discount hold at
// once. Looks the row up by charge_id, releases its code (if any) and marks it REJECT. Idempotent: an
// already-REJECT row releases nothing (releaseRedemption returns released:false), and an APPROVED row is
// left alone — a settled payment must never have its redemption removed.
export async function abandonByChargeId(
  chargeId: string,
  // 🔴 #455 slice 3 — WHY a reason at all, when the status alone would "work".
  // Feem chose to reuse REJECT rather than add an EXPIRED status, to ship sooner. That choice is only
  // reversible while the two causes stay distinguishable in the data. `failure_code` already exists
  // (#437, migration 0010), is plain text with no CHECK, and is otherwise written verbatim from Omise.
  // Writing the cause here costs no migration and keeps this answerable:
  //   walked away  status='REJECT' AND failure_code = 'gateway_expired'
  //   refused      status='REJECT' AND failure_code IS DISTINCT FROM those
  // Omitting it is still valid — the webhook path passes nothing and behaves exactly as before.
  reason: string | null = null,
  db: Db = defaultDb,
): Promise<{ released: boolean }> {
  const [row] = await db
    .select({
      id: v2Payment.id,
      codeId: v2Payment.codeId,
      status: v2Payment.status,
      failureCode: v2Payment.failureCode,
    })
    .from(v2Payment)
    .where(eq(v2Payment.chargeId, chargeId))
    .limit(1)
  if (!row || row.status === 'APPROVED') return { released: false }
  // Never overwrite a cause the gateway already gave us: what Omise said outranks what we inferred.
  await abandonPending(row.id, row.codeId ?? null, db, row.failureCode ? null : reason)
  return { released: true }
}

// 🔴 #484 — A REVERSED CHARGE TAKES THE ENTITLEMENT WITH IT. Feem's rule, stated once: a payment that
// did not stay successful grants nothing. Today nothing implements it — abandonByChargeId returns at
// repo.ts's APPROVED guard without touching a thing, and `reversed` appears nowhere in any write path.
//
// 🔴 WHAT THIS DELIBERATELY DOES NOT TOUCH, and why the guards above stay exactly as they are:
//   · v2_payment.status stays 'APPROVED'. The charge WAS paid; that is history, not a claim about today.
//     It also keeps settleAndProvision's `ne(status,'APPROVED')` idempotency intact — flip the row back
//     and a late duplicate charge.complete could grant the whole thing again (#371's hole, reopened).
//   · abandonByChargeId's APPROVED guard is untouched. It exists to stop a stray event un-settling a real
//     payment, and this is a separate door, not a widening of that one.
// The reversal is recorded as a REASON (failure_code), never as a verdict on the payment itself.
//
// TWO LANES HOLD THE ENTITLEMENT AND BOTH MUST MOVE:
//   member_subscription  one row per purchase → ACTIVE becomes EXPIRED. lib/v2/subscription.ts:71 reads
//                        `status === 'ACTIVE' && expireAt >= today`, so this alone ends the v2 lane.
//   member_payment       ONE row per user, written GREATEST → cannot be walked back by arithmetic. It is
//                        restored from prev_member_expire_at (#484, 0012), taking the LATER of that and
//                        whatever ACTIVE rows the user still holds, so a purchase made AFTER this one is
//                        not thrown away with it.
// If prev_member_expire_at is NULL the row predates 0012: the v2 lane is still revoked, and the shadow is
// left ALONE and logged loudly. Guessing a date there would silently shorten a membership someone paid for.
export async function revokeByChargeId(
  chargeId: string,
  db: Db = defaultDb,
): Promise<{ revoked: boolean; shadowHandled: 'RESTORED' | 'CLEARED' | 'NEEDS_HUMAN' | 'NONE' }> {
  return db.transaction(async (tx) => {
    const [pay] = await tx
      .select({
        id: v2Payment.id,
        userId: v2Payment.userId,
        status: v2Payment.status,
        failureCode: v2Payment.failureCode,
        prevMemberExpireAt: v2Payment.prevMemberExpireAt,
      })
      .from(v2Payment)
      .where(eq(v2Payment.chargeId, chargeId))
      .limit(1)

    // Not ours, or never granted anything. `failed`/`expired` land here too and correctly do nothing.
    if (!pay || pay.status !== 'APPROVED') return { revoked: false, shadowHandled: 'NONE' }
    // Already done. Re-delivery of the same reversal must not run the shadow restore a second time, or a
    // purchase made between the two deliveries would be undone by the second one.
    if (pay.failureCode === REVERSED_CODE) return { revoked: false, shadowHandled: 'NONE' }

    await tx.update(v2Payment).set({ failureCode: REVERSED_CODE }).where(eq(v2Payment.id, pay.id))

    // Only an ACTIVE row is moved, ON PURPOSE. If a later purchase already superseded this one the row is
    // 'REPLACED', which grants nothing anyway (lib/v2/subscription.ts:71 asks for ACTIVE), so there is
    // nothing to take back on that side. It does mean "a reversal ends the v2 lane" is exactly true only
    // for a row that was still live: for a superseded one the only trace of the reversal is failure_code on
    // v2_payment, which is the right place for it — the entitlement was already gone. (too, review probe.)
    await tx
      .update(memberSubscription)
      .set({ status: 'EXPIRED' })
      .where(and(eq(memberSubscription.v2PaymentId, pay.id), eq(memberSubscription.status, 'ACTIVE')))

    // 🔴 WHAT SURVIVES IS DECIDED BY WHETHER THE MONEY STAYED, NOT BY THE SUBSCRIPTION'S STATUS
    // (too, review of 0abb9d5, proved both directions with rows).
    // 'REPLACED' means a later purchase superseded this one. It does NOT mean the money came back. Filter
    // on status = 'ACTIVE' and a paid-for month vanishes the moment a newer purchase is reversed:
    //   base X → A pushes to A → B pushes to B.  reverse ONLY B ⇒ A's row is REPLACED ⇒ dropped from the
    //   survivors ⇒ the user falls all the way back to X, and A's money was never refunded.
    // The two errors are mirror images and no choice of FLOOR fixes both — the floor was never the broken
    // part. A row is legitimate when the payment behind it is still APPROVED and was not reversed, whatever
    // the subscription status says.
    // Rows with no v2_payment link are pre-v2 grants: nothing can have reversed them, so they count too.
    const subs = await tx
      .select({ expireAt: memberSubscription.expireAt, paymentId: memberSubscription.v2PaymentId })
      .from(memberSubscription)
      .where(eq(memberSubscription.userId, pay.userId))
    const dead = await tx
      .select({ id: v2Payment.id, status: v2Payment.status, failureCode: v2Payment.failureCode })
      .from(v2Payment)
      .where(eq(v2Payment.userId, pay.userId))
    const deadIds = new Set(
      dead.filter((r) => r.status !== 'APPROVED' || r.failureCode === REVERSED_CODE).map((r) => r.id),
    )
    const latestSurvivor = subs
      .filter((r) => r.paymentId === null || !deadIds.has(r.paymentId))
      .reduce<string | null>((best, r) => (best === null || String(r.expireAt) > best ? String(r.expireAt) : best), null)

    // 🔴 prev_member_expire_at ON ITS OWN IS NOT A SAFE FLOOR (too, review of 9bb1915, proved with rows).
    // It stores what the shadow WAS, and what it was may itself have come from a purchase that is later
    // reversed too. Reverse both and the naive restore lands on the reversed purchase's date:
    //   base X → A pushes to A → B pushes to B.  reverse B ⇒ B.prev = A ⇒ the user keeps A's month,
    //   and A's money went back as well. member_payment is what lib/usage.ts:33 reads, so that is a real
    //   entitlement, not a bookkeeping detail.
    // The floor that survives any number of reversals is the EARLIEST captured value for this user: the
    // upsert is GREATEST, so the captured values are non-decreasing over time, and the minimum of them is
    // the shadow as it stood before v2 ever touched it — the legacy baseline.
    // NULLs (rows from before 0012) are skipped rather than treated as zero. If the true earliest is one of
    // them the floor comes out too HIGH, which leaves the user holding more than they paid for. That is the
    // safe direction: we never take away time we cannot prove was ours to take.
    const captured = await tx
      .select({ prev: v2Payment.prevMemberExpireAt })
      .from(v2Payment)
      .where(and(eq(v2Payment.userId, pay.userId), eq(v2Payment.status, 'APPROVED')))
    // Three outcomes, not two. The captured values are non-decreasing (the upsert is GREATEST), so the
    // earliest one is the floor — and '' sorts before every date, which is exactly right: if any purchase
    // saw no shadow at all, the floor is nothing.
    const knownFloors = captured.map((r) => r.prev).filter((v): v is string => typeof v === 'string')
    const sawNothing = knownFloors.includes(NO_SHADOW)
    const anyUnknown = captured.some((r) => r.prev === null)
    const baseline = sawNothing
      ? null
      : knownFloors.reduce<string | null>((best, v) => (best === null || v < best ? v : best), null)

    // Nothing left standing AND we measured that there was nothing to begin with ⇒ take the shadow away.
    // This is the first-time buyer whose money came back: leaving the row is leaving them a paid tier.
    if (sawNothing && latestSurvivor === null) {
      await tx.delete(memberPayment).where(eq(memberPayment.userId, pay.userId))
      return { revoked: true, shadowHandled: 'CLEARED' }
    }

    if (baseline === null && latestSurvivor === null) {
      // Nothing to restore from and nothing left standing: the honest answer is "we do not know what this
      // user's shadow should say", so it is not written over. See the migration header for why.
      console.error(
        `[#484] reversal revoked the v2 lane but member_payment was left ALONE — charge=${chargeId} ` +
          `payment=${pay.id} user=${pay.userId} unknownCaptures=${anyUnknown}. This payment settled ` +
          `BEFORE the capture in settleAndProvision shipped, so the value it overwrote was never recorded ` +
          `— it is not "no entitlement", it is "we do not know". A human decides what ` +
          `member_payment.expire_at should be for this user. This set is finite and shrinking: it can only ` +
          `contain payments that settled before this code deployed.`,
      )
      return { revoked: true, shadowHandled: 'NEEDS_HUMAN' }
    }

    const restored = [baseline, latestSurvivor]
      .filter((v): v is string => typeof v === 'string' && v !== '')
      .reduce((a, b) => (a > b ? a : b))
    await tx.update(memberPayment).set({ expireAt: restored }).where(eq(memberPayment.userId, pay.userId))
    return { revoked: true, shadowHandled: 'RESTORED' }
  })
}

// Omise accepted → swap the placeholder for the real charge id (this is what the webhook will match).
//
// 🔴 #455 — `chargeExpiresAt` rides along on THIS update on purpose. It is the one write that already
// happens after Omise has answered, so recording the deadline costs no extra round-trip and no extra
// transaction. Passing nothing leaves the column untouched (card charges have no expiry); passing null
// writes null, which reads as "the gateway did not say" — never as "not expired".
export async function attachChargeId(
  paymentId: string,
  chargeId: string,
  expiresAt?: string | null,
  db: Db = defaultDb,
): Promise<void> {
  const patch: { chargeId: string; chargeExpiresAt?: Date | null } = { chargeId }
  if (expiresAt !== undefined) {
    const at = expiresAt === null ? null : new Date(expiresAt)
    // A gateway string we cannot parse is NOT a deadline. Store null rather than an Invalid Date, which
    // would silently become NULL in postgres anyway and lose the fact that we tried.
    patch.chargeExpiresAt = at !== null && Number.isNaN(at.getTime()) ? null : at
  }
  await db.update(v2Payment).set(patch).where(eq(v2Payment.id, paymentId))
}

// 🔴 #437 — the gateway answered and the answer was "no". Write down WHY, next to the row it belongs to.
// Deliberately does NOT touch `status`: the verdict is abandonPending's job, and keeping the two apart is
// what stops a reason from ever being mistaken for a state. Safe to call with both fields null (a gateway
// that refused without saying why still gets a row that says "asked, got nothing").
export async function recordChargeFailure(
  paymentId: string,
  failure: { code: string | null; message: string | null },
  db: Db = defaultDb,
): Promise<void> {
  await db
    .update(v2Payment)
    .set({ failureCode: failure.code, failureMessage: failure.message })
    .where(eq(v2Payment.id, paymentId))
}

// The charge failed → release the code reservation (used_count back) and mark the row REJECT so it can
// never settle. Safe to call when no code was used (codeId null).
export async function abandonPending(
  paymentId: string,
  codeId: string | null,
  db: Db = defaultDb,
  // 🔴 #455 slice 3, round 2 (too). The cause used to be a SECOND statement after this one, and the way
  // that failed was the way that inverts the answer: statement 1 lands REJECT, statement 2 fails, the row
  // reads REJECT + failure_code NULL — which the ticket's own query classifies as "the bank refused".
  // A customer who walked away would be recorded as a refusal, and that is the exact distinction this
  // whole change exists to protect. One UPDATE, so the two facts cannot disagree.
  // Pass null (the webhook path does) and the column is left exactly as it was.
  reason: string | null = null,
): Promise<void> {
  if (codeId) await releaseRedemption(codeId, paymentId, db)
  await db
    .update(v2Payment)
    .set(reason ? { status: 'REJECT', failureCode: reason } : { status: 'REJECT' })
    .where(eq(v2Payment.id, paymentId))
}

/**
 * #360 — the rows the reconciler may consider. The WINDOW is applied in SQL (so a long-lived table does
 * not get pulled into memory) but the RULE that decides which of them to act on stays pure
 * (lib/payment/reconcile.ts) — the same split the month gate uses: narrow in SQL, decide in code, one copy
 * of the rule that a unit test can argue with.
 */
export async function listUnsettledPayments(
  since: Date,
  db: Db = defaultDb,
): Promise<Array<{ id: string; chargeId: string; orderId: string; status: string; createdAt: Date }>> {
  return db
    .select({
      id: v2Payment.id,
      chargeId: v2Payment.chargeId,
      orderId: v2Payment.orderId,
      status: v2Payment.status,
      createdAt: v2Payment.createdAt,
    })
    .from(v2Payment)
    .where(and(eq(v2Payment.status, 'PENDING'), gte(v2Payment.createdAt, since)))
}

export async function listUserPayments(userId: string, db: Db = defaultDb) {
  return db
    .select({
      chargeId: v2Payment.chargeId,
      orderId: v2Payment.orderId,
      packageCode: v2Payment.packageCode,
      tierCode: v2Payment.tierCode,
      amountSatang: v2Payment.amountSatang,
      method: v2Payment.method,
      status: v2Payment.status,
      createdAt: v2Payment.createdAt,
      // #455 — the screen cannot know when a QR died unless we carry it. NULL for card rows and for any
      // row created before 0011; the caller must treat NULL as "unknown", never as "still good".
      chargeExpiresAt: v2Payment.chargeExpiresAt,
      // 🔴 #455 slice 3 — WHY THIS HAD TO COME OUT TOO, and why leaving it in was a real defect.
      // Feem chose to reuse REJECT rather than add EXPIRED. I argued in the ticket that failure_code
      // keeps the two causes separable — and then never carried it past the server, so the screen saw
      // ONE 'REJECT' with TWO meanings. lamun found it by reading this payload instead of trusting the
      // claim. That is #437's shape exactly: the server held what the gateway said and shipped only the id.
      // NULL means the gateway gave no reason AND we inferred none — never "it was fine".
      failureCode: v2Payment.failureCode,
    })
    .from(v2Payment)
    .where(eq(v2Payment.userId, userId))
    .orderBy(desc(v2Payment.createdAt))
}

// ── #456: what does this person hold RIGHT NOW? ───────────────────────────────────────────────────
// Read for the repurchase/upgrade decision. Two callers, deliberately the SAME function: the door
// (charge-flow, before any money moves) and the settlement (inside settleAndProvision's transaction, where
// it is the authoritative read — the world may have moved between charge and webhook).
//
// 🔴 This does NOT re-derive either membership rule. The v2 side reuses toSubRows + pickActiveSubscriptionRow
// (lib/v2/subscription.ts, the ONE copy of the selection rule — #369 B2), and the legacy side reuses
// classifyMembership (lib/usage-core.ts, the ONE copy the v1 path uses). #456 said not to touch
// subscription.ts and this is why it does not need to: the rule is imported, not rewritten.
//
// The tier NAME still goes through parseTierCode: a tier_code the reader cannot map must never be placed on
// the ladder as if it were a known level (#354 B1). Unmappable ⇒ tier null ⇒ the legacy branch of
// decidePurchase, which allows rather than refuses. Fail towards not locking a paying customer out.
export type CurrentEntitlement = Entitlement & {
  /** ids of EVERY member_subscription row that counts as live today — the rows an upgrade must supersede.
   *  Enumerated by running the exported picker until it runs dry, so "live" has exactly ONE definition in
   *  the codebase and this file never re-states it as a WHERE clause that could drift from the reader. */
  supersedeIds: string[]
}

export async function readEntitlement(
  userId: string,
  now: Date = new Date(),
  db: Db = defaultDb,
): Promise<CurrentEntitlement> {
  const today = bkkDateStr(now)
  const subs = await db.select().from(memberSubscription).where(eq(memberSubscription.userId, userId))
  const rows = toSubRows(subs)

  // Drain the picker: each pass yields the row that would decide membership if the ones already taken were
  // gone. One human has few rows (one per purchase), so this is a handful of passes over a handful of rows.
  const supersedeIds: string[] = []
  let pool = rows
  for (;;) {
    const r = pickActiveSubscriptionRow(pool, today)
    if (!r) break
    supersedeIds.push(r.id)
    pool = pool.filter((x) => x.id !== r.id)
  }

  const live = pickActiveSubscriptionRow(rows, today)
  if (live) {
    // The HIGHEST tier among the live rows, which is not always the row the picker returned (it sorts by
    // expire_at, not by tier). supersedeIds already IS the live set, so it is reused rather than re-filtered.
    const liveById = new Map(rows.map((r) => [r.id, r]))
    let highestLiveTier: TierCode | null = null
    let best = -1
    for (const id of supersedeIds) {
      const t = parseTierCode(liveById.get(id)?.tierCode)
      const r = tierRank(t)
      if (r !== null && r > best) {
        best = r
        highestLiveTier = t
      }
    }
    return {
      tier: parseTierCode(live.tierCode),
      isPaid: true,
      expireAt: live.expireAt,
      highestLiveTier,
      supersedeIds,
    }
  }

  // No live v2 row ⇒ the legacy member_payment verdict, exactly as lib/v2/subscription.ts falls back.
  const [mp] = await db
    .select({ planCode: memberPayment.planCode, expireAt: memberPayment.expireAt })
    .from(memberPayment)
    .where(eq(memberPayment.userId, userId))
    .limit(1)
  const legacy = classifyMembership(mp ?? null, now)
  // No live v2 row ⇒ nothing to supersede: a legacy membership lives on member_payment, whose one row is
  // MERGED by the shadow's GREATEST, never replaced.
  if (legacy.isFree) return { tier: null, isPaid: false, expireAt: null, highestLiveTier: null, supersedeIds: [] }
  // Paid, but member_payment has no tier column — this is the unnamed LEGACY member (#456's 6th row).
  return {
    tier: null,
    isPaid: true,
    expireAt: String(mp?.expireAt ?? '').slice(0, 10) || null,
    highestLiveTier: null,
    supersedeIds: [],
  }
}

/** The door's question in one call: may this user buy this tier, and what follows them if so? */
export async function decidePurchaseFor(
  userId: string,
  targetTier: TierCode,
  now: Date = new Date(),
  db: Db = defaultDb,
): Promise<PurchaseDecision> {
  const current = await readEntitlement(userId, now, db)
  return decidePurchase({ current, targetTier, today: bkkDateStr(now) })
}

// 🔴 ATOMIC settlement — the DB is the arbiter (#355 ⑤). In ONE transaction:
//   1. conditional UPDATE status PENDING→APPROVED WHERE charge_id AND status<>'APPROVED' — exactly one of
//      two concurrent webhooks changes a row; the loser's UPDATE matches 0 rows (Postgres re-checks the
//      predicate after the first commits) → it provisions nothing.
//   2. the winner inserts ONE member_subscription row (history) + upserts the member_payment shadow with
//      expire_at = GREATEST(existing, new) computed IN SQL, so even two DIFFERENT charges for the same user
//      settling at once never shorten the membership.
// Returns whether THIS call provisioned. Idempotent: a replay after settlement changes 0 rows → false.
/**
 * What a settlement attempt actually did. `provisioned` alone conflated FIVE different worlds — the comment
 * on this function used to list three of them and got one of those wrong (it claimed an already-REJECT row
 * returns 0 rows; the predicate is `status <> 'APPROVED'`, so a REJECT row is flipped and provisioned).
 * The webhook cannot tell "we granted it" from "we have never heard of this charge" without this, and those
 * two need OPPOSITE handling: one is routine, the other means somebody's money is sitting outside our books.
 */
export type SettleOutcome =
  | 'PROVISIONED' // matched by charge_id and granted just now
  | 'RECOVERED' //   charge_id was never attached (the money moved but the write did not) → matched by order_id
  | 'ALREADY' //     a row exists and is already APPROVED — a replay/duplicate delivery. Routine.
  | 'NO_ROW' //      nothing matches by charge_id OR order_id. 🔴 money may exist outside our records.
  | 'AMBIGUOUS' //   more than one row carries that order_id → refuse to guess which payment this is.

export async function settleAndProvision(
  chargeId: string,
  orderId: string | null = null,
  now: Date = new Date(),
  db: Db = defaultDb,
): Promise<{ provisioned: boolean; outcome: SettleOutcome }> {
  return db.transaction(async (tx) => {
    const approved = await tx
      .update(v2Payment)
      .set({ status: 'APPROVED' })
      .where(and(eq(v2Payment.chargeId, chargeId), ne(v2Payment.status, 'APPROVED')))
      .returning()

    let pay = approved[0]
    let outcome: SettleOutcome = 'PROVISIONED'

    if (!pay) {
      // Nothing moved on charge_id. Three different worlds live here — tell them apart before answering.
      const [existing] = await tx
        .select({ id: v2Payment.id, status: v2Payment.status })
        .from(v2Payment)
        .where(eq(v2Payment.chargeId, chargeId))
        .limit(1)
      if (existing) return { provisioned: false, outcome: 'ALREADY' } // it is ours and already granted

      // 🔴 #371 — THE RECOVERY. The row is written BEFORE the money moves (#361), so if Omise says a charge
      // succeeded and no row carries that charge_id, the row almost certainly exists WITHOUT it: the charge
      // was created and `attachChargeId` never landed (deploy, DB blip, or the webhook simply arrived first
      // — PromptPay fires fast). order_id is the one identifier that is on the row before any money moves
      // AND travels to Omise as metadata, so it is what closes that window.
      if (!orderId) return { provisioned: false, outcome: 'NO_ROW' }
      const candidates = await tx
        .select({ id: v2Payment.id, status: v2Payment.status, chargeId: v2Payment.chargeId })
        .from(v2Payment)
        .where(eq(v2Payment.orderId, orderId))
      // order_id is 10 random digits and carries NO uniqueness constraint, so a collision is possible.
      // Picking "whichever row the planner returned" would grant a stranger's payment to somebody else —
      // the same refuse-on-ambiguity rule resolveUserFromRows follows for identity (ตู๋ #254 B2).
      if (candidates.length === 0) return { provisioned: false, outcome: 'NO_ROW' }
      if (candidates.length > 1) return { provisioned: false, outcome: 'AMBIGUOUS' }
      const [cand] = candidates
      if (cand.status === 'APPROVED') return { provisioned: false, outcome: 'ALREADY' }
      // Only a row still holding its placeholder may adopt this charge id. A row already bound to a REAL
      // charge belongs to that charge; taking it would move one person's payment onto another's record.
      if (cand.chargeId !== placeholderChargeId(cand.id)) {
        return { provisioned: false, outcome: 'AMBIGUOUS' }
      }
      const [recovered] = await tx
        .update(v2Payment)
        .set({ status: 'APPROVED', chargeId })
        .where(and(eq(v2Payment.id, cand.id), ne(v2Payment.status, 'APPROVED')))
        .returning()
      if (!recovered) return { provisioned: false, outcome: 'ALREADY' } // lost a race to a concurrent delivery
      pay = recovered
      outcome = 'RECOVERED'
    }

    // Duration comes from the FROZEN terms on v2_payment (ตู๋ #370 B2) — NOT a fresh payment_package read,
    // so a package edited between charge and settle can't change what this paid charge is worth.
    const [existing] = await tx
      .select({ expireAt: memberPayment.expireAt })
      .from(memberPayment)
      .where(eq(memberPayment.userId, pay.userId))
      .limit(1)

    // 🔴 #484 — CAPTURE THE SHADOW'S OLD VALUE HERE, IN THE SAME TRANSACTION THAT IS ABOUT TO REPLACE IT.
    // The upsert below writes expire_at = GREATEST(old, new). After that statement the old value does not
    // exist anywhere: member_payment is one row per user, and it is not reconstructible from the surviving
    // member_subscription rows either, because a legacy member's baseline was never a v2 row. This is the
    // only moment it can be recorded, and a reversal (#484) is the only reader. Writing it inside the
    // transaction means a rollback takes it with the grant — the two can never disagree.
    // NULL is written when the user had no shadow row at all; a reversal treats that as "unknown" and
    // hands the member_payment side to a human rather than inventing a date.
    //
    // 🔴 THE EMPTY STRING IS NOT A MISSING VALUE, IT IS AN ANSWER (too, PROBE-C on 9203a56).
    // Writing NULL for "this user had no shadow row" collapses it with "nobody ever wrote this column",
    // and those two need opposite handling on a reversal: the first is a fact we measured (there was
    // nothing, so a reversal must leave nothing), the second is ignorance (hand it to a human).
    // Collapsed, the most common case in the product — a FIRST-TIME buyer whose money is returned — fell
    // into the ignorance branch and kept their entitlement, which is the sentence this ticket opens with.
    // The column is plain text with no CHECK, so '' costs no migration. It is unambiguous because nothing
    // had ever written this column in PRODUCTION when this line shipped: 0012 shipped the column, this line
    // ships the first writer, so NULL means exactly "settled before this code did" and nothing else.
    //
    // 🔴 THE RECEIPT IS PINNED HERE BECAUSE IT CANNOT BE RE-FIRED (too, on mootech-fe#484). The measurement
    // below stops being reproducible the moment the first reversal settles — after that a non-NULL value
    // is this writer working correctly, and "nothing has ever written it" can never be established again.
    // Read-only queries against prod, inside BEGIN TRANSACTION READ ONLY, at main = f928481 (the merge
    // commit of mootech-fe#487). Bound to the COMMIT, not to a date: main moves several times an hour.
    //
    //   prev_member_expire_at | text | is_nullable YES | no default    ← matches 0012 exactly
    //   count(*) where prev_member_expire_at is not null   = 0         ← the claim above, measured
    //   count(*) where status='APPROVED' and it is null    = 2         ← every APPROVED row there is
    //   whole table: APPROVED 2, REJECT 3
    //
    // The last two numbers constrain each other: 2 = all of APPROVED, so no approved row was skipped by
    // the first count. A single number could have been a filter typo; two that must agree cannot.
    //
    // 🔴 THE EARLIER WORDING SAID "on any environment" AND THAT WAS WRONG IN BOTH DIRECTIONS — too caught
    // the gap between what the sentence claimed and what anyone had actually looked at:
    //   prod     measured, above.
    //   dev      CANNOT be measured — the jgxsj project was retired 2026-06-19 and the pooler now answers
    //            `FATAL: (ENOTFOUND) tenant/user ... not found`. An unmeasurable environment is not a
    //            clean one.
    //   testenv  measured: column present, 0 rows, 0 rows total — but scripts/reversal-revoke-db.test.ts
    //            writes this column on every run and cleans up after itself, so "nothing has ever written
    //            it" is plainly FALSE there. It does not matter (testenv data is disposable), which is
    //            exactly why the sentence must say PRODUCTION rather than sweep it in.
    // ⇒ the claim a reader relies on is about production rows, and it now says so.
    await tx
      .update(v2Payment)
      .set({ prevMemberExpireAt: existing?.expireAt ?? NO_SHADOW })
      .where(eq(v2Payment.id, pay.id))

    // 🔴 #456 — READ THE CURRENT ENTITLEMENT HERE, INSIDE THE TRANSACTION, not at charge time. The door
    // (charge-flow) already refused the purchases that must never happen, but the door's answer is minutes
    // old by the time a webhook lands and it was never the authority: the row this writes must be computed
    // from what the user holds AT SETTLEMENT. If two accepted charges settle back to back, the second one
    // reads the first one's row and carries ITS remaining days — the chain stays honest without a lock.
    const held = await readEntitlement(pay.userId, now, tx as unknown as Db)

    // 🔴 #456 (ตู๋, review of 2c196b8) — ASK THE MATRIX HERE TOO. The door asked when the charge was
    // CREATED; between then and now the buyer may have bought something better, and an abandoned PromptPay
    // charge stays PENDING indefinitely, so "then" can be days ago. decideSettlement answers the webhook's
    // own question — what may we WRITE — which is not the door's question of what may be BOUGHT.
    // 🔴 BOTH SIDES OF THE COMPARISON GO THROUGH parseTierCode (ตู๋, review r2). `held` always did; this
    // side used a bare `as TierCode`, so one half of the same comparison was checked and the other was
    // asserted. The DB's CHECK on v2_payment.tier_code (0007:30) makes an unmappable value unreachable
    // today — that is a reason it has not bitten, not a reason to keep the asymmetry.
    const paidTier = parseTierCode(pay.tierCode)
    const settlement =
      paidTier === null
        ? ({ grant: false, reason: 'WOULD_DOWNGRADE' } as const) // unplaceable ⇒ never let it win
        : decideSettlement({ current: held, paidTier, today: bkkDate(now) })
    const carryOverDays = settlement.grant ? settlement.carryOverDays : 0
    // A payment that would demote the buyer is still RECORDED (v2_payment is APPROVED above — money that
    // moved is never un-recorded) but its subscription row is born superseded: it never becomes the live
    // row, and it supersedes nothing. Whether that money is refunded or kept as credit is ฟีม's call and
    // is deliberately NOT decided here; what could not wait for that answer is that nobody gets demoted.
    const rowStatus: 'ACTIVE' | 'REPLACED' = settlement.grant ? 'ACTIVE' : 'REPLACED'

    const { subscription, shadow } = buildProvision({
      userId: pay.userId,
      quote: {
        packageCode: pay.packageCode,
        tierCode: pay.tierCode as TierCode,
        amountSatang: pay.amountSatang,
        vatSatang: pay.vatSatang,
        expire: parseExpireSpec(pay.expire),
        bufferDay: Number(pay.bufferDay),
      },
      paymentId: pay.id,
      today: bkkDate(now),
      existingMemberPayment: existing ?? null,
      carryOverDays,
    })

    // 🔴 #456 — the rows whose days we just carried over are now SUPERSEDED, and they are marked in the SAME
    // transaction that writes their successor. Same-transaction is the whole point: a crash between the two
    // would otherwise leave a user holding two live rows again, which is the bug this ticket exists for.
    // status='REPLACED' is already in the schema (lib/db/schema.ts:748, migration 0006) — no migration here.
    // Nothing is deleted: the superseded rows keep their amount and span as the payment history they are.
    if (settlement.grant && held.supersedeIds.length > 0) {
      await tx
        .update(memberSubscription)
        .set({ status: 'REPLACED' })
        .where(
          and(
            eq(memberSubscription.userId, pay.userId),
            inArray(memberSubscription.id, held.supersedeIds),
          ),
        )
    }

    await tx.insert(memberSubscription).values({
      id: randomUUID(),
      userId: subscription.userId,
      tierCode: subscription.tierCode,
      packageCode: subscription.packageCode,
      amountSatang: subscription.amountSatang,
      startAt: subscription.startAt,
      expireAt: subscription.expireAt,
      // v1 payment_id FK stays NULL for v2; the v2_payment link goes in v2_payment_id (0007).
      v2PaymentId: subscription.paymentId,
      status: rowStatus,
    })

    // Shadow: plan_code always MEMBER (rule ①); expire_at = GREATEST in SQL (rule ②, atomic vs concurrent
    // same-user settlements). member_payment PK is user_id → upsert.
    await tx
      .insert(memberPayment)
      .values({
        userId: pay.userId,
        planCode: 'MEMBER',
        packageCode: pay.packageCode,
        createAt: bkkTimestamp(now),
        startAt: shadow.startAt,
        expireAt: subscription.expireAt,
      })
      .onConflictDoUpdate({
        target: memberPayment.userId,
        set: {
          planCode: 'MEMBER',
          packageCode: pay.packageCode,
          startAt: shadow.startAt,
          expireAt: sql`GREATEST(${memberPayment.expireAt}, ${subscription.expireAt})`,
        },
      })

    // 🔴 #371 — a REJECTed row that turns out to have been PAID had its discount hold released by
    // abandonPending. The purchase really happened, so the redemption belongs back on the books: leaving it
    // off makes used_count LESS true, and the next buyer can spend a slot this sale already consumed.
    // Restored WITHOUT the quota gate on purpose — the gate exists to stop a NEW use from exceeding the
    // limit, not to un-record a completed one. If that pushes used_count past max_use_total, that number is
    // the honest count of what was sold, and it is visible; the alternative is a silent undercount.
    if (pay.codeId) {
      // vat_percent_at_purchase is required on the redemption row and is NOT on v2_payment — it lives on
      // the quote. A payment that carries a code ALWAYS carries the quote it was previewed with (the charge
      // flow refuses a code without one, ตู๋ #372 ②), so this read is not a maybe. If it ever comes back
      // empty we skip the restore rather than invent a rate: a wrong number on a money row is worse than a
      // missing row, and the missing row is what NO_ROW-style logging is for.
      const [q] = await tx
        .select({ vatPercent: paymentQuote.vatPercent })
        .from(paymentQuote)
        .where(eq(paymentQuote.id, pay.quoteId ?? ''))
        .limit(1)
      if (q) {
        await restoreRedemption(tx as never, {
          codeId: pay.codeId,
          userId: pay.userId,
          paymentId: pay.id,
          discountSatang: pay.discountSatang ?? 0,
          vatPercent: q.vatPercent,
        })
      }
    }

    return { provisioned: true, outcome }
  })
}
