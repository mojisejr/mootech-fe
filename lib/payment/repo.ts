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
export async function abandonByChargeId(chargeId: string, db: Db = defaultDb): Promise<{ released: boolean }> {
  const [row] = await db
    .select({ id: v2Payment.id, codeId: v2Payment.codeId, status: v2Payment.status })
    .from(v2Payment)
    .where(eq(v2Payment.chargeId, chargeId))
    .limit(1)
  if (!row || row.status === 'APPROVED') return { released: false }
  await abandonPending(row.id, row.codeId ?? null, db)
  return { released: true }
}

// Omise accepted → swap the placeholder for the real charge id (this is what the webhook will match).
export async function attachChargeId(paymentId: string, chargeId: string, db: Db = defaultDb): Promise<void> {
  await db.update(v2Payment).set({ chargeId }).where(eq(v2Payment.id, paymentId))
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
): Promise<void> {
  if (codeId) await releaseRedemption(codeId, paymentId, db)
  await db.update(v2Payment).set({ status: 'REJECT' }).where(eq(v2Payment.id, paymentId))
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
