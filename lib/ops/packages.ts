// /ops package administration (mootech-fe#377) — the FIRST write path /ops has ever had, so the rules of
// what it may change are spelled out here, PURE and testable, separate from the I/O below.
//
// ฟีม 2026-08-22: /ops may change the PRICE and the ON-SALE flag. It may NOT create packages — a new
// package has to be bound to a tier (and later to entitlement ceilings), which is a code change anyway; a
// package created from a screen would be one nothing grants.
import { eq, inArray } from 'drizzle-orm'
import { db as defaultDb } from '@/lib/db'
import { paymentPackage } from '@/lib/db/schema'
import { parseTierCode } from '@/lib/v2/tier'

type Db = typeof defaultDb

// Money arrives from a form, so it is text until proven otherwise. Rules: a whole number of baht, ≥ 0
// (0 = "price not decided yet", which is exactly the monthly rows' state), and under a sanity ceiling so a
// fat finger cannot publish ฿1,000,000. A package priced 0 can exist but can never be SOLD — quotePackage
// refuses a non-positive amount, and the on-sale flag is a separate decision.
export const MAX_PRICE_BAHT = 100_000

export type PriceEdit = { packageCode: string; amountBaht: number; isActive: boolean }
export type EditRefusal = { ok: false; reason: 'BAD_PRICE' | 'BAD_PACKAGE' | 'SELLING_A_ZERO_PRICE' }

/** Validate one row of the ops form. Pure — no DB. */
export function validateEdit(raw: {
  packageCode: unknown
  amountBaht: unknown
  isActive: unknown
}): { ok: true; edit: PriceEdit } | EditRefusal {
  const packageCode = typeof raw.packageCode === 'string' ? raw.packageCode.trim() : ''
  if (!packageCode) return { ok: false, reason: 'BAD_PACKAGE' }

  const amountBaht = typeof raw.amountBaht === 'number' ? raw.amountBaht : Number(raw.amountBaht)
  if (!Number.isFinite(amountBaht) || !Number.isInteger(amountBaht)) return { ok: false, reason: 'BAD_PRICE' }
  if (amountBaht < 0 || amountBaht > MAX_PRICE_BAHT) return { ok: false, reason: 'BAD_PRICE' }

  const isActive = raw.isActive === true || raw.isActive === 'true'

  // 🔴 Turning a 0-baht package ON would put a free "sale" on the screen that the charge lane then refuses
  // (quotePackage rejects a non-positive amount) — a button that cannot work. Refuse it here, with a reason.
  if (isActive && amountBaht <= 0) return { ok: false, reason: 'SELLING_A_ZERO_PRICE' }

  return { ok: true, edit: { packageCode, amountBaht, isActive } }
}

export type OpsPackage = {
  packageCode: string
  planCode: string
  description: string
  tierCode: string
  amountBaht: number
  expire: string
  isActive: boolean
  /** false when tier_code is a value the reader cannot map — surfaced so ops can SEE a broken row. */
  tierKnown: boolean
}

export async function listPackages(db: Db = defaultDb): Promise<OpsPackage[]> {
  const rows = await db
    .select()
    .from(paymentPackage)
    .where(inArray(paymentPackage.planCode, ['MEMBER']))
    .orderBy(paymentPackage.packageCode)
  return rows.map((r) => ({
    packageCode: r.packageCode,
    planCode: r.planCode,
    description: r.description,
    tierCode: r.tierCode,
    amountBaht: Number(r.amount),
    expire: r.expire,
    isActive: r.isActive,
    tierKnown: parseTierCode(r.tierCode) !== null,
  }))
}

/**
 * Apply one edit. Only `amount` and `is_active` are writable — tier_code, package_code, expire and every
 * other column are untouched, so /ops can never turn a PLUS package into PRO or invent a package.
 * Returns false when no such package exists (the form named something that is not there).
 */
export async function applyEdit(edit: PriceEdit, db: Db = defaultDb): Promise<boolean> {
  const updated = await db
    .update(paymentPackage)
    .set({ amount: edit.amountBaht, isActive: edit.isActive })
    .where(eq(paymentPackage.packageCode, edit.packageCode))
    .returning({ packageCode: paymentPackage.packageCode })
  return updated.length > 0
}
