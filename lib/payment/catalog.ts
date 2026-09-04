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

// ── QI PACKS (buy-qi ก้อน 1.6) ────────────────────────────────────────────────────────────────────
// แพ็กชี่ขายผ่านราง Omise v2 เดียวกับ Plus/Pro แต่ไม่ใช่สมาชิก: settle แล้ว "เครดิตชี่เข้า engine"
// ไม่ใช่เขียน member_subscription (ดู settleAndProvision เลน QI). ปริมาณชี่ต่อแพ็ก = ข้อเท็จจริงของ
// โค้ด (เหมือน catalog ของ engine) — แพ็กที่ไม่รู้จักต้อง fail loud ก่อนถึง till ทั้งที่ quote และตอน
// grant; ราคา (amount) ยังมาจาก payment_package แถวจริงเสมอ (แก้ราคาที่ /ops โดยไม่ deploy).
export const QI_PACK_CODES = ['QI_60', 'QI_200', 'QI_500', 'QI_1200'] as const
export type QiPackCode = (typeof QI_PACK_CODES)[number]

/** จำนวน QI ต่อ package_code — ตัวเลขจากจอ buy-qi (60/200/500/1,200); ราคาอยู่ใน DB (payment_package) */
export const QI_PACK_QTY: Record<QiPackCode, number> = {
  QI_60: 60,
  QI_200: 200,
  QI_500: 500,
  QI_1200: 1200,
}

/** โบนัส QI แถมต่อแพ็ก (Figma buy-qi): 60→0 · 200→+20 · 500→+75 · 1,200→+250. เครดิตจริงตอน grant. */
export const QI_PACK_BONUS: Record<QiPackCode, number> = {
  QI_60: 0,
  QI_200: 20,
  QI_500: 75,
  QI_1200: 250,
}

export function qiQtyOf(packageCode: string): number | null {
  return (QI_PACK_CODES as readonly string[]).includes(packageCode)
    ? QI_PACK_QTY[packageCode as QiPackCode]
    : null
}

/** โบนัส QI แถมต่อแพ็ก (0 ถ้าไม่รู้จัก/ไม่มีโบนัส) */
export function qiBonusOf(packageCode: string): number {
  return (QI_PACK_CODES as readonly string[]).includes(packageCode)
    ? QI_PACK_BONUS[packageCode as QiPackCode]
    : 0
}

/** อัตรา VAT (แบบรวมในราคา — สกัดย้อนกลับ) สำหรับโชว์ในสรุปยอด/ใบเสร็จ. (#362 จะย้ายไป app_setting) */
export const VAT_RATE = 0.07

// The package row shape the catalog needs (subset of payment_package). Kept explicit so the pure function
// never depends on the drizzle row type / DB.
export type PackageRow = {
  packageCode: string
  planCode: string
  amount: number // THB (payment_package.amount, a float)
  expire: string // "1Y" | "1M" | "30D" — single value+unit (v1's strict /^(\d+)([DMY])$/)
  bufferDay: number
  // #377: both now come from the DB row, not from code.
  tierCode: string // payment_package.tier_code — NOT NULL + CHECK at the DB
  isActive: boolean // payment_package.is_active — false ⇒ not for sale
}

// 🔴 #377: the tier a package grants lives in the DATABASE (payment_package.tier_code), not in a map here.
// The old hardcoded PACKAGE_TIER meant adding or re-pricing a package required a deploy, which made the
// /ops screen pointless. parseTierCode still guards the value on the way in — a tier_code the reader cannot
// map must never read as "paid" (#354 B1) — and the DB has its own CHECK + NOT NULL (see 0009 for why the
// CHECK alone is not enough: NULL slips through `IN (…)`).

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
  /** 'QI' = แพ็กชี่ (ไม่ใช่สมาชิก — เลน settle แยก); อื่น ๆ คือบันไดสมาชิกตามเดิม */
  tierCode: TierCode | 'QI'
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
  // Not for sale ⇒ refuse BEFORE any pricing. This is the server-side half of "ปิดขายจาก /ops": hiding the
  // card on the screen is not enough, the API must refuse the package_code too (#377 DoD).
  if (!pkg.isActive) {
    throw new UnsellablePackageError(pkg.packageCode, 'not on sale')
  }

  // 🔴 QI pack: ไม่ใช่บันไดสมาชิก — ราคาตามปกติ แต่ tier เดินเป็น 'QI' (settle เลนอื่น).
  // ปริมาณชี่ต้องรู้จัก ณ ที่นี่: โค้ดที่ไม่รู้จักห้ามถึง till (เงินห้ามวิ่งก่อนรู้ว่าขายอะไร)
  const isQiPack = pkg.tierCode === 'QI'
  if (isQiPack && qiQtyOf(pkg.packageCode) === null) {
    throw new UnsellablePackageError(pkg.packageCode, 'QI pack without a known qi quantity')
  }

  const tierCode = parseTierCode(pkg.tierCode)
  // 🔴 The `=== 'FREE'` half is load-bearing OUTSIDE this file, and its only pin is one row of one test.
  // A FREE tier passes 0006's CHECK and maps cleanly, so nothing downstream refuses it: a live FREE
  // member_subscription row makes resolveSubscription answer not-paid for someone whose member_payment row
  // says they are paid, and both calendar gates then refuse them (mootech-fe#525). This line is the reason
  // no PURCHASE can create that row — note it sits AFTER the isActive check at :74 and never reads
  // isActive, so flipping a FREE package on from /ops does not open the path either.
  // 🔴 In scripts/payment-catalog.test.ts MC1 the row that actually exercises THIS clause is `horoscope`
  // (:33, amount 690). Measured 2026-08-29 by deleting `|| tierCode === 'FREE'` and running the three rows
  // individually: `free` (:32) still throws on the amount check, `garbageTier` (:34) still throws on the
  // null half, and only :33 reddens. Delete :33 as a near-duplicate of :32 and MC1 keeps its name and its
  // green tick while no longer testing this clause at all.
  if (!isQiPack && (tierCode === null || tierCode === 'FREE')) {
    throw new UnsellablePackageError(pkg.packageCode, 'no paid tier for it')
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
    tierCode: isQiPack ? 'QI' : (tierCode as TierCode), // เงื่อนไข throw ด้านบนคือพยานว่า non-QI แล้วเป็น paid tier
    amountSatang,
    vatSatang,
    expire: parseExpireSpec(pkg.expire),
    bufferDay: Number(pkg.bufferDay) || 0,
  }
}
