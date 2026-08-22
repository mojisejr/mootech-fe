// v2 payment I/O (mootech-fe#355) — the ONLY layer that touches the DB. The decision logic is pure
// (catalog/provision); this file reads/writes and owns the ATOMIC settlement.
import { and, eq, ne, desc, sql } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import { db as defaultDb } from '@/lib/db'
import { v2Payment, memberPayment, memberSubscription, paymentPackage, user } from '@/lib/db/schema'
import { parseExpireSpec, type PackageRow } from './catalog'
import { buildProvision } from './provision'
import { reserveCodeInTx, releaseRedemption, Refuse } from '@/lib/discount/repo'
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

// 🔴 ATOMIC settlement — the DB is the arbiter (#355 ⑤). In ONE transaction:
//   1. conditional UPDATE status PENDING→APPROVED WHERE charge_id AND status<>'APPROVED' — exactly one of
//      two concurrent webhooks changes a row; the loser's UPDATE matches 0 rows (Postgres re-checks the
//      predicate after the first commits) → it provisions nothing.
//   2. the winner inserts ONE member_subscription row (history) + upserts the member_payment shadow with
//      expire_at = GREATEST(existing, new) computed IN SQL, so even two DIFFERENT charges for the same user
//      settling at once never shorten the membership.
// Returns whether THIS call provisioned. Idempotent: a replay after settlement changes 0 rows → false.
export async function settleAndProvision(
  chargeId: string,
  now: Date = new Date(),
  db: Db = defaultDb,
): Promise<{ provisioned: boolean }> {
  return db.transaction(async (tx) => {
    const approved = await tx
      .update(v2Payment)
      .set({ status: 'APPROVED' })
      .where(and(eq(v2Payment.chargeId, chargeId), ne(v2Payment.status, 'APPROVED')))
      .returning()
    if (approved.length === 0) return { provisioned: false } // lost the race, unknown charge, or already REJECT
    const pay = approved[0]

    // Duration comes from the FROZEN terms on v2_payment (ตู๋ #370 B2) — NOT a fresh payment_package read,
    // so a package edited between charge and settle can't change what this paid charge is worth.
    const [existing] = await tx
      .select({ expireAt: memberPayment.expireAt })
      .from(memberPayment)
      .where(eq(memberPayment.userId, pay.userId))
      .limit(1)

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
    })

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
      status: subscription.status,
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

    return { provisioned: true }
  })
}
