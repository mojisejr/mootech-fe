// v2 discount I/O (mootech-fe#361) — the ONLY layer that touches the DB. The math is pure (rules.ts); this
// owns the code lookup, the server-fixed quote, and the ATOMIC reserve+redeem that gates concurrency.
import { and, eq, sql } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import { db as defaultDb } from '@/lib/db'
import { discountCode, discountRedemption, paymentQuote } from '@/lib/db/schema'
import type { DiscountCodeSpec } from './rules'

type Db = typeof defaultDb
const rowsOf = (r: unknown): Array<Record<string, unknown>> =>
  Array.isArray(r) ? r : ((r as { rows?: Array<Record<string, unknown>> })?.rows ?? [])

export type DiscountCodeRow = typeof discountCode.$inferSelect

// Case-INsensitive lookup (v1's bug was case-sensitive → 'Yijing'/'YIJING' collisions). Returns null if no
// such code — the caller turns that into "invalid code", NOT a silent no-discount (rule ③ / lesson: unknown
// must not read as a valid outcome).
export async function getCodeByString(codeStr: string, db: Db = defaultDb): Promise<DiscountCodeRow | null> {
  const [row] = await db
    .select()
    .from(discountCode)
    .where(sql`lower(${discountCode.code}) = lower(${codeStr})`)
    .limit(1)
  return row ?? null
}

// 🔴 The v1 code table still exists and 43 codes live in it (16 redemptions). Two things follow, both DoD:
//   • a holder of a v1 code (e.g. INFLU_001) typing it into the new screen must NOT be told "invalid code" —
//     it IS a real code, it just belongs to the other system (free-package grant, not a discount).
//   • a NEW discount code must not take a name that already exists there, case-insensitively.
// Both are one question — "does this string already name a code anywhere?" — asked case-insensitively,
// because v1 had no unique index and 'Yijing'/'YIJING' already collided in its log.
export async function findLegacyCode(codeStr: string, db: Db = defaultDb): Promise<{ code: string } | null> {
  const rows = await db.execute(
    sql`SELECT code FROM payment_code WHERE lower(code) = lower(${codeStr}) LIMIT 1`,
  )
  const row = rowsOf(rows)[0]
  return row ? { code: String(row.code) } : null
}

// Guard for creating a discount code (the /ops screen is #362; the RULE lives here so both callers share
// it). Taken = the name exists in the new table OR in v1's payment_code, ignoring case.
export async function isCodeNameTaken(codeStr: string, db: Db = defaultDb): Promise<boolean> {
  if (await getCodeByString(codeStr, db)) return true
  return (await findLegacyCode(codeStr, db)) !== null
}

export function toSpec(row: DiscountCodeRow): DiscountCodeSpec {
  return {
    kind: row.kind as DiscountCodeSpec['kind'],
    value: row.value,
    maxDiscountSatang: row.maxDiscountSatang,
    appliesTo: row.appliesTo ?? [],
    status: row.status as DiscountCodeSpec['status'],
    startsAt: row.startsAt ? row.startsAt.toISOString() : null,
    endsAt: row.endsAt ? row.endsAt.toISOString() : null,
  }
}

export async function insertQuote(
  q: {
    userId: string
    packageCode: string
    codeId: string | null
    listSatang: number
    discountSatang: number
    amountSatang: number
    vatPercent: number
    expiresAt: Date
  },
  db: Db = defaultDb,
): Promise<string> {
  const id = randomUUID()
  await db.insert(paymentQuote).values({ id, ...q })
  return id
}

export async function getQuote(quoteId: string, userId: string, db: Db = defaultDb) {
  const [row] = await db
    .select()
    .from(paymentQuote)
    .where(and(eq(paymentQuote.id, quoteId), eq(paymentQuote.userId, userId)))
    .limit(1)
  return row ?? null
}

export class Refuse extends Error {
  constructor(public readonly reason: 'FULL' | 'PER_USER') {
    super(reason)
  }
}

// The reserve steps, taking an EXISTING transaction — so the caller can put the v2_payment INSERT in the
// SAME transaction (see lib/payment/repo.insertPendingReserved). Throws Refuse; the caller's txn rolls back
// and used_count reverts itself.
// 🔴 LAYER 1 of the leak fix (ตู๋ #372 ③): a reservation whose QUOTE has expired can never be paid at that
// price, so its hold is dead — release it. This runs INSIDE the reserve transaction, before the counter is
// taken, so it needs no cron and no background sweeper: any contention on a code cleans that code's own
// dead holds first. (#360's reconciler will call releaseExpiredHolds() for the whole table; that ticket
// owns the sweep. THIS makes the common case — the same user coming back to reuse their own code — heal
// without anyone running anything.)
//
// Dead = v2_payment still PENDING, holding this code, whose payment_quote.expires_at is in the past. We
// delete those redemptions and give the counter back by exactly the number deleted (never below 0).
const RELEASE_EXPIRED_SQL = (codeIdFilter: unknown) => sql`
  WITH dead AS (
    DELETE FROM discount_redemption dr
     USING v2_payment p, payment_quote q
     WHERE dr.payment_id = p.id
       AND p.quote_id = q.id
       AND p.status = 'PENDING'
       AND q.expires_at < now()
       ${codeIdFilter}
    RETURNING dr.code_id
  ), counted AS (
    SELECT code_id, count(*)::int AS n FROM dead GROUP BY code_id
  )
  UPDATE discount_code c
     SET used_count = GREATEST(c.used_count - counted.n, 0)
    FROM counted
   WHERE c.id = counted.code_id
  RETURNING c.id, counted.n`

/** Release dead holds for ONE code (called inside the reserve txn). Returns how many were freed. */
export async function releaseExpiredHoldsForCode(
  tx: { execute: (q: unknown) => Promise<unknown> },
  codeId: string,
): Promise<number> {
  const r = await tx.execute(RELEASE_EXPIRED_SQL(sql`AND dr.code_id = ${codeId}`))
  const row = rowsOf(r)[0]
  return Number(row?.n ?? 0)
}

/** Release dead holds across EVERY code — the entry point #360's reconciler will call. */
export async function releaseExpiredHolds(db: Db = defaultDb): Promise<number> {
  const r = await db.execute(RELEASE_EXPIRED_SQL(sql``))
  return rowsOf(r).reduce((sum, row) => sum + Number(row?.n ?? 0), 0)
}

export async function reserveCodeInTx(
  tx: {
    execute: (q: unknown) => Promise<unknown>
    insert: (t: unknown) => { values: (v: unknown) => Promise<unknown> }
  },
  args: {
    codeId: string
    userId: string
    paymentId: string
    discountSatang: number
    vatPercent: number
    maxUsePerUser: number | null
  },
): Promise<void> {
  // ⓪ free this code's dead holds first (layer 1) — a QR nobody scanned must not keep the slot, and must
  // not keep the SAME user locked out of their own max_use_per_user=1 code forever.
  await releaseExpiredHoldsForCode(tx, args.codeId)

  // ① conditional UPDATE — THIS row is the concurrency gate (not an index). Parallel users contend on its
  // lock; the predicate is re-checked after the winner commits, so past max_use_total everyone matches 0.
  const upd = await tx.execute(sql`
    UPDATE discount_code SET used_count = used_count + 1
    WHERE id = ${args.codeId}
      AND status = 'ACTIVE'
      AND (starts_at IS NULL OR now() >= starts_at)
      AND (ends_at   IS NULL OR now() <  ends_at)
      AND (max_use_total IS NULL OR used_count < max_use_total)
    RETURNING used_count`)
  if (rowsOf(upd).length === 0) throw new Refuse('FULL')

  // ② per-user ceiling — runs UNDER ①'s row lock (same txn) ⇒ serialized, not a racy read-then-write.
  if (args.maxUsePerUser != null) {
    const cnt = await tx.execute(sql`
      SELECT count(*)::int AS c FROM discount_redemption
      WHERE code_id = ${args.codeId} AND user_id = ${args.userId}`)
    if (Number(rowsOf(cnt)[0]?.c ?? 0) >= args.maxUsePerUser) throw new Refuse('PER_USER')
  }

  // ③ the redemption row (UNIQUE code_id,payment_id blocks any double-count later).
  await tx.insert(discountRedemption).values({
    id: randomUUID(),
    codeId: args.codeId,
    userId: args.userId,
    paymentId: args.paymentId,
    discountSatang: args.discountSatang,
    vatPercentAtPurchase: args.vatPercent,
  })
}

// 🔴 ATOMIC reserve+redeem (charge time). In ONE transaction:
//   ① conditional UPDATE used_count+1 — the row this touches is the CONCURRENCY GATE (not an index): two
//      parallel uses of the same code both contend on this row's lock; the predicate re-checks after the
//      first commits, so once max_use_total is hit every later UPDATE matches 0 rows.
//   ② per-user count — runs UNDER ①'s row lock (same txn), so it is serialized, not a racy read-then-write.
//   ③ INSERT the redemption (UNIQUE code_id,payment_id blocks a webhook double-count).
// A refusal throws → the txn rolls back → used_count reverts itself. payment_id is the v2_payment.id the
// caller will insert next; if the charge then fails, releaseRedemption puts the count back.
export async function reserveAndRedeem(
  args: {
    codeId: string
    userId: string
    paymentId: string
    discountSatang: number
    vatPercent: number
    maxUsePerUser: number | null
  },
  db: Db = defaultDb,
): Promise<{ ok: true } | { ok: false; reason: 'FULL' | 'PER_USER' }> {
  try {
    await db.transaction(async (tx) => {
      await reserveCodeInTx(tx as never, args)
    })
    return { ok: true }
  } catch (e) {
    if (e instanceof Refuse) return { ok: false, reason: e.reason }
    throw e
  }
}

// The return path (ตู๋: "used_count must go back"): a charge that failed / a quote that expired before
// settlement. Deletes the redemption and decrements used_count (never below 0). Idempotent — if the
// redemption is already gone, used_count is left alone.
export async function releaseRedemption(
  codeId: string,
  paymentId: string,
  db: Db = defaultDb,
): Promise<{ released: boolean }> {
  return db.transaction(async (tx) => {
    const del = await tx
      .delete(discountRedemption)
      .where(and(eq(discountRedemption.codeId, codeId), eq(discountRedemption.paymentId, paymentId)))
      .returning()
    if (del.length === 0) return { released: false }
    await tx
      .update(discountCode)
      .set({ usedCount: sql`GREATEST(${discountCode.usedCount} - 1, 0)` })
      .where(eq(discountCode.id, codeId))
    return { released: true }
  })
}
