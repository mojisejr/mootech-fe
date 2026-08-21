// v2 payment I/O (mootech-fe#355) — the ONLY layer that touches the DB. The decision logic is pure
// (catalog/provision); this file reads/writes and owns the ATOMIC settlement.
import { and, eq, ne, desc, sql } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import { db as defaultDb } from '@/lib/db'
import { v2Payment, memberPayment, memberSubscription, paymentPackage, user } from '@/lib/db/schema'
import { parseExpireSpec, type PackageRow } from './catalog'
import { buildProvision } from './provision'
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

    const pkgRows = await tx
      .select({ expire: paymentPackage.expire, bufferDay: paymentPackage.bufferDay })
      .from(paymentPackage)
      .where(eq(paymentPackage.packageCode, pay.packageCode))
      .orderBy(paymentPackage.id)
      .limit(1)
    if (!pkgRows[0]) throw new Error('package vanished between charge and settle') // rolls back the APPROVE

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
        expire: parseExpireSpec(pkgRows[0].expire),
        bufferDay: Number(pkgRows[0].bufferDay),
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
