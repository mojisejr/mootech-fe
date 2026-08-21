// v2 discount RULES (mootech-fe#361, Phase 9) — PURE, no DB/Omise. The ONE place the money math for a
// discount code lives, so preview.ts and charge.ts compute the SAME number (ตู๋ T6: one formula, two
// callers — never two copies). The client sends only the code STRING; the amount and the discount are both
// computed here from the code row the server looked up (rule 1).
//
// 🔴 Locked formula (ฟีม 2026-08-21) — order fixed:
//     list (annual price, already after the annual discount = payment_package.amount×100)
//   − code discount   (from THIS list, floor for PERCENT so the discount never exceeds what was advertised)
//   = amount payable   (VAT-inclusive; VAT extracted BACKWARD, never a stored column)
// Rounding (ตู๋ T6): PERCENT discount = floor(satang×p/100); VAT = round(amount×r/(100+r)).
// No 100%-off / negative amounts (ตู๋ B4): discount is capped by max_discount_satang, clamped to ≤ list,
// and the amount must clear a gateway minimum or the code is REFUSED (the free-grant path stays on the v1
// payment_code system — a different job).

export type DiscountKind = 'PERCENT' | 'FIXED'
export type DiscountStatus = 'ACTIVE' | 'PAUSED' | 'EXPIRED'

// Minimal, DB-free shape of a discount_code row the pure rules need.
export type DiscountCodeSpec = {
  kind: DiscountKind
  value: number // PERCENT: 10 = 10% · FIXED: satang
  maxDiscountSatang: number | null // cap for BOTH kinds (ตู๋ B4); null = no cap
  appliesTo: string[] // package_codes; [] = every package
  status: DiscountStatus
  startsAt: string | null // ISO; null = no lower bound
  endsAt: string | null // ISO; null = no upper bound
}

// Omise's card minimum is ฿20; anything below is rejected by the gateway, so a code that would drop the
// amount under this is refused up front with a clear reason instead of failing at Omise.
export const MIN_CHARGE_SATANG = 2000

export type Refusal = { ok: false; reason: 'STATUS' | 'WINDOW' | 'NOT_APPLICABLE' | 'BELOW_MIN' }

// Does this code apply to this package at this moment? (status ACTIVE, within the time window, package in
// applies_to or applies_to empty.) Quota (used_count / per-user) is NOT here — that is the DB's job (repo).
export function codeApplies(
  code: DiscountCodeSpec,
  packageCode: string,
  now: Date,
): { ok: true } | Refusal {
  if (code.status !== 'ACTIVE') return { ok: false, reason: 'STATUS' }
  const t = now.getTime()
  if (code.startsAt && t < Date.parse(code.startsAt)) return { ok: false, reason: 'WINDOW' }
  if (code.endsAt && t >= Date.parse(code.endsAt)) return { ok: false, reason: 'WINDOW' }
  if (code.appliesTo.length > 0 && !code.appliesTo.includes(packageCode)) {
    return { ok: false, reason: 'NOT_APPLICABLE' }
  }
  return { ok: true }
}

// The raw discount in satang for a base list price — capped by max_discount_satang and clamped to ≤ list
// (so the amount can never go negative). PERCENT floors so the discount never exceeds the advertised %.
export function discountSatangFor(listSatang: number, code: DiscountCodeSpec): number {
  const raw =
    code.kind === 'PERCENT'
      ? Math.floor((listSatang * code.value) / 100)
      : Math.max(0, Math.round(code.value))
  const capped = code.maxDiscountSatang != null ? Math.min(raw, code.maxDiscountSatang) : raw
  return Math.min(Math.max(0, capped), listSatang) // never negative, never more than the price
}

// VAT extracted BACKWARD from an inclusive amount. vatPercent 0 ⇒ 0 (no VAT line). Integer satang.
export function vatBackward(amountSatang: number, vatPercent: number): number {
  return vatPercent > 0 ? Math.round((amountSatang * vatPercent) / (100 + vatPercent)) : 0
}

export type QuoteLines = {
  listSatang: number
  discountSatang: number
  amountSatang: number // list − discount, VAT-inclusive
  vatSatang: number
}

// Full quote for a (validated-applicable) code on a list price. Returns the line breakdown, or a BELOW_MIN
// refusal when the discount would drop the amount under the gateway minimum (ตู๋ B4 — no 100%-off here).
export function quoteWithCode(args: {
  listSatang: number
  code: DiscountCodeSpec
  vatPercent: number
  minChargeSatang?: number
}): QuoteLines | Refusal {
  const min = args.minChargeSatang ?? MIN_CHARGE_SATANG
  const discountSatang = discountSatangFor(args.listSatang, args.code)
  const amountSatang = args.listSatang - discountSatang
  if (amountSatang < min) return { ok: false, reason: 'BELOW_MIN' }
  return {
    listSatang: args.listSatang,
    discountSatang,
    amountSatang,
    vatSatang: vatBackward(amountSatang, args.vatPercent),
  }
}
