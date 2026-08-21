// v2 payment CATALOG (mootech-fe#355, Phase 3) — PURE, no DB, no Omise. Turns a payment_package row into
// the server-authoritative { amount to charge, VAT breakdown, tier granted }. The client NEVER sends an
// amount or a discount — everything here is computed from the package row the server looked up.
//
// 🔴 Lesson ③ (from #354): a value we cannot map must FAIL LOUD, never default to a "safe-looking" answer.
// An unmappable package_code throws BEFORE any charge is created — the v1 hole (#355 ③) was: package not in
// the provisioning list ⇒ card charged, row APPROVED, email "success", but NO membership written, silently.
//
// 🔴 Pricing formula, locked by ฟีม 2026-08-21 — order is fixed:
//     full price (monthly × 12)  −  annual discount  −  code discount  =  amount payable
//     VAT is computed BACKWARD from the final amount (VAT-inclusive), never stored/added as a column.
// #355 scope: code discount = 0 (stub; the real engine lands in #361 with quote_id), VAT rate = 0 (stub;
// app_setting arrives in #362). The payment_package row's `amount` IS the annual list price today (real
// prices await marketing); when #361 introduces monthly×12 − annualDiscount it replaces `listSatang`
// below and slots the real code discount into `codeDiscountSatang`. The formula's SHAPE is here now so the
// money lane is touched once per phase, not rewritten.
import { parseTierCode, type TierCode } from '@/lib/v2/tier'

// The package row shape the catalog needs (subset of payment_package). Kept explicit so the pure function
// never depends on the drizzle row type / DB.
export type PackageRow = {
  packageCode: string
  planCode: string
  amount: number // THB (payment_package.amount, a float)
  expire: string // "1Y" | "1M" | "30D" — single value+unit (v1's strict /^(\d+)([DMY])$/)
  bufferDay: number
}

// package_code → the v2 tier it grants. ALLOW-LIST, fail-loud on a miss (lesson ③). These are the real
// paid MEMBER subscription packages that exist today, all mapped to the base paid tier PLUS. The PLUS/PRO
// split and any real sale packages are marketing's call (#361 / marketing) — 'PRO' stays reserved in the
// enum + DB CHECK, ready, but #355 does not invent an assignment. Free/promo/topup/horoscope packages are
// deliberately ABSENT ⇒ a charge for one fails loud before touching Omise.
// ⚠️ REVIEW ME (ตู๋/ฟีม): confirm this mapping when marketing sets real packages.
export const PACKAGE_TIER: Readonly<Record<string, TierCode>> = {
  MONTHLY: 'PLUS',
  SOULMATE: 'PLUS',
  FAMILY_2: 'PLUS',
  FAMILY_3: 'PLUS',
  FAMILY_4: 'PLUS',
  FAMILY_5: 'PLUS',
  FAMILY_6: 'PLUS',
}

export class UnsellablePackageError extends Error {
  constructor(public readonly packageCode: string, reason: string) {
    super(`package_code ${JSON.stringify(packageCode)} is not sellable in v2: ${reason}`)
    this.name = 'UnsellablePackageError'
  }
}

export type ExpireSpec = { value: number; unit: 'D' | 'M' | 'Y' }

// Parse payment_package.expire strictly, exactly as v1 does (member-payment.service.ts): ^(\d+)([DMY])$.
// Anything else (spaces, lowercase, "1Y 6M", empty) throws — a malformed duration must not silently grant
// a wrong-length membership.
export function parseExpireSpec(expire: string): ExpireSpec {
  const m = /^(\d+)([DMY])$/.exec(expire ?? '')
  if (!m) throw new UnsellablePackageError('?', `invalid expire format ${JSON.stringify(expire)}`)
  return { value: parseInt(m[1], 10), unit: m[2] as ExpireSpec['unit'] }
}

export type Quote = {
  packageCode: string
  tierCode: TierCode
  amountSatang: number // what Omise charges (VAT-inclusive)
  vatSatang: number // VAT extracted from amountSatang (0 when rate is 0)
  expire: ExpireSpec
  bufferDay: number
}

// Compute the server-authoritative quote for a package. Throws UnsellablePackageError on: an unmapped
// package_code, a non-positive/NaN amount, or a malformed expire. codeDiscountSatang and vatRate are the
// #361/#362 seams — default to the #355 stubs (0).
export function quotePackage(
  pkg: PackageRow,
  opts: { codeDiscountSatang?: number; vatRate?: number } = {},
): Quote {
  const tierCode = parseTierCode(PACKAGE_TIER[pkg.packageCode] ?? null)
  if (tierCode === null || tierCode === 'FREE') {
    throw new UnsellablePackageError(pkg.packageCode, 'no paid tier is mapped for it')
  }

  const listSatang = Math.round(Number(pkg.amount) * 100) // v1 parity: Math.round(amount*100)
  if (!Number.isFinite(listSatang) || listSatang <= 0) {
    throw new UnsellablePackageError(pkg.packageCode, `non-positive amount ${JSON.stringify(pkg.amount)}`)
  }

  const codeDiscountSatang = Math.max(0, Math.round(opts.codeDiscountSatang ?? 0)) // #355 stub = 0
  const amountSatang = listSatang - codeDiscountSatang
  if (amountSatang <= 0) {
    throw new UnsellablePackageError(pkg.packageCode, 'discount reduces the amount to zero or less')
  }

  // VAT is INCLUSIVE and extracted backward: vat = amount − amount/(1+rate) = round(amount*rate/(1+rate)).
  // rate 0 ⇒ 0 ⇒ no VAT line. The amount charged does NOT change with the rate (it is already inclusive).
  const vatRate = opts.vatRate ?? 0 // #355 stub = 0 (app_setting → #362)
  const vatSatang = vatRate > 0 ? Math.round((amountSatang * vatRate) / (1 + vatRate)) : 0

  return {
    packageCode: pkg.packageCode,
    tierCode,
    amountSatang,
    vatSatang,
    expire: parseExpireSpec(pkg.expire),
    bufferDay: Number(pkg.bufferDay) || 0,
  }
}
