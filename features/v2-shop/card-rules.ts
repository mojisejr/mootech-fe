// features/v2-shop/card-rules.ts — the one place that answers "is what the buyer typed a usable card,
// and if not, which field is wrong" (mootech-fe#447). Pure functions: no React, no network, no clock of
// its own. Two callers, one answer:
//
//   CardForm.tsx        renders which field is wrong          (mootech-fe#491, lamun)
//   checkout.tsx        decides whether Pay may be pressed    (mootech-fe#492)
//
// 🔴 WHY THIS EXISTS AT ALL. Omise ships no validation. Its JS exposes setPublicKey, createToken and
// createSource plus the OmiseCard prebuilt form — no Luhn, no expiry check, no CVC check, no brand
// detection. So "follow the Omise standard" has no standard to follow on this side; we write it.
// Feem's decision on 2026-08-28 was to keep our own inputs (SAQ A-EP) rather than move to OmiseCard's
// iframe, precisely so that "the buyer cannot type nonsense, and cannot press Pay while it is wrong"
// stays ours to guarantee. Inside OmiseCard it would not be.
//
// 🔴 NO DEPENDENCY WAS ADDED, DELIBERATELY. The checkout page holds a real PAN in its own DOM, and today
// exactly one external script loads anywhere in the app (omise.js, from Omise's own CDN — see
// pages/_document.tsx:19). Every library added to this page is more code that can read a card number.
// A hundred lines we own is the cheaper side of that trade.

export type CardField = 'name' | 'number' | 'expiry' | 'cvc'

/**
 * Machine-readable reasons. NOT sentences — the words a buyer sees belong to the screen, so copy can be
 * rewritten without touching a rule, and a rule can change without silently rewording a screen.
 */
export type CardReason =
  | 'empty'
  | 'number_too_short'
  | 'number_length' //  right shape for the brand's family, wrong number of digits
  | 'number_luhn' //    fails the checksum every card number satisfies — almost always a typo
  | 'expiry_format' //  we cannot read it as a month and a year at all
  | 'expiry_month' //   month outside 01–12
  | 'expiry_past' //    readable, and already gone
  | 'cvc_length'

export type CardBrand = 'visa' | 'mastercard' | 'amex' | 'jcb' | 'unionpay' | 'discover' | 'diners' | 'unknown'

export type CardState = { name: string; number: string; expiry: string; cvc: string }

export type CardValidation = {
  /** True only when every field below is null. Never assembled separately — see validateCard. */
  ok: boolean
  fields: Record<CardField, CardReason | null>
}

export const digitsOnly = (s: string): string => s.replace(/\D+/g, '')

// ── brand ────────────────────────────────────────────────────────────────────────────────────────────
// Ranges are the published IIN assignments. Matching is done on the LEADING digits of whatever has been
// typed so far, so the brand appears while the buyer is still typing — that is the whole point of showing
// it (DESIGN.md:359 gives the checkout row a 20px brand icon, and CardForm has never had one).
const inRange = (d: string, lo: number, hi: number, len: number): boolean => {
  if (d.length < len) return false
  const head = Number(d.slice(0, len))
  return head >= lo && head <= hi
}

export function detectBrand(input: string): CardBrand {
  const d = digitsOnly(input)
  if (d.length === 0) return 'unknown'
  if (d.startsWith('4')) return 'visa'
  if (inRange(d, 51, 55, 2) || inRange(d, 2221, 2720, 4)) return 'mastercard'
  if (d.startsWith('34') || d.startsWith('37')) return 'amex'
  if (inRange(d, 3528, 3589, 4)) return 'jcb'
  // Diners before Discover: 36/38/39 and 300–305 would otherwise be caught by nothing, and 3095 is a
  // single point inside a range that is not contiguous.
  if (inRange(d, 300, 305, 3) || d.startsWith('3095') || d.startsWith('36') || inRange(d, 38, 39, 2)) return 'diners'
  if (d.startsWith('6011') || inRange(d, 644, 649, 3) || d.startsWith('65')) return 'discover'
  if (d.startsWith('62')) return 'unionpay'
  return 'unknown'
}

/** Digit counts each brand actually issues. 'unknown' stays wide on purpose — see validateCard. */
const BRAND_LENGTHS: Record<CardBrand, number[]> = {
  visa: [13, 16, 19],
  mastercard: [16],
  amex: [15],
  jcb: [16, 17, 18, 19],
  unionpay: [16, 17, 18, 19],
  discover: [16, 17, 18, 19],
  diners: [14, 15, 16, 17, 18, 19],
  unknown: [12, 13, 14, 15, 16, 17, 18, 19],
}

/** Amex prints a 4-digit code; everyone else prints 3. */
export const cvcLengthFor = (brand: CardBrand): number => (brand === 'amex' ? 4 : 3)

// ── luhn ─────────────────────────────────────────────────────────────────────────────────────────────
export function passesLuhn(input: string): boolean {
  const d = digitsOnly(input)
  if (d.length < 2) return false
  let sum = 0
  let double = false
  for (let i = d.length - 1; i >= 0; i -= 1) {
    let n = d.charCodeAt(i) - 48
    if (double) {
      n *= 2
      if (n > 9) n -= 9
    }
    sum += n
    double = !double
  }
  return sum % 10 === 0
}

// ── formatting ───────────────────────────────────────────────────────────────────────────────────────
// These run on every keystroke. They only ever REMOVE non-digits and INSERT separators, so a paste from a
// password manager — "4242-4242 4242 4242" — survives it.
//
// 🔴 NEVER BLOCK PASTE. Refusing pasted text is the fastest way to make a password-manager user unable to
// pay at all, which is a worse outcome than the typo we were guarding against.

export function formatCardNumber(input: string, brand: CardBrand = detectBrand(input)): string {
  const max = Math.max(...BRAND_LENGTHS[brand])
  const d = digitsOnly(input).slice(0, max)
  // Amex is printed 4-6-5, not in fours. Grouping it in fours is the kind of detail people notice.
  const groups = brand === 'amex' ? [4, 6, 5] : [4, 4, 4, 4, 4]
  const out: string[] = []
  let i = 0
  for (const g of groups) {
    if (i >= d.length) break
    out.push(d.slice(i, i + g))
    i += g
  }
  return out.join(' ')
}

/**
 * MM/YYYY, with the slash inserted for the buyer.
 *
 * 🔴 THIS IS THE FIX FOR THE WHOLE CLASS, not a nicety. pages/v2/shop/checkout.tsx:58 does
 * `card.expiry.split('/')`, so "042026" put the entire string into expiration_month and `undefined` into
 * expiration_year, tokenisation failed, and the buyer was shown a screen saying their BANK declined —
 * for a slash. If the field cannot hold a slash-less value, that failure cannot be reached.
 */
export function formatExpiry(input: string): string {
  const d = digitsOnly(input).slice(0, 6)
  if (d.length <= 2) return d
  return `${d.slice(0, 2)}/${d.slice(2)}`
}

export type ParsedExpiry = { month: number; year: number }

/**
 * Read anything a human might reasonably type. Accepts MM/YYYY, M/YYYY, MM/YY, MMYYYY, MMYY.
 *
 * 🔴 FIVE BARE DIGITS ARE REFUSED ON PURPOSE. "42026" is either 4/2026 or 42/026 and nothing in the
 * string decides which. Guessing here would put a wrong month on a real charge, so it returns null and
 * the buyer is told the format is unreadable — the one honest answer.
 */
export function parseExpiry(input: string): ParsedExpiry | null {
  const s = input.trim()
  if (s === '') return null

  let mm: string
  let yy: string
  if (s.includes('/')) {
    const parts = s.split('/')
    if (parts.length !== 2) return null
    mm = digitsOnly(parts[0])
    yy = digitsOnly(parts[1])
    if (mm.length < 1 || mm.length > 2) return null
  } else {
    const d = digitsOnly(s)
    if (d.length === 4) [mm, yy] = [d.slice(0, 2), d.slice(2)]
    else if (d.length === 6) [mm, yy] = [d.slice(0, 2), d.slice(2)]
    else return null
  }

  if (yy.length !== 2 && yy.length !== 4) return null
  const month = Number(mm)
  // A two-digit year is this century. Cards are not issued to expire in 1998.
  const year = yy.length === 2 ? 2000 + Number(yy) : Number(yy)
  if (!Number.isInteger(month) || !Number.isInteger(year)) return null
  return { month, year }
}

/** A card is good through the LAST day of its printed month, so compare against the month, not a day. */
export function isExpired(e: ParsedExpiry, now: Date): boolean {
  const y = now.getUTCFullYear()
  const m = now.getUTCMonth() + 1
  return e.year < y || (e.year === y && e.month < m)
}

// ── the answer ───────────────────────────────────────────────────────────────────────────────────────
/**
 * 🔴 `ok` IS DERIVED FROM `fields`, NEVER COMPUTED BESIDE IT. Two independently-built halves can disagree
 * — a payload that says ok:true while naming a broken field is exactly the shape of contradiction this
 * team has been paying for all week. Built this way, it cannot be constructed.
 *
 * `now` is a parameter, not `new Date()` inside: a rule that reads a clock it owns cannot be tested for
 * the boundary that matters (this month vs last month).
 */
export function validateCard(state: CardState, now: Date): CardValidation {
  const brand = detectBrand(state.number)
  const digits = digitsOnly(state.number)

  const numberReason = ((): CardReason | null => {
    if (digits.length === 0) return 'empty'
    // Below the shortest number any brand issues, "wrong length" is noise while they are still typing.
    if (digits.length < 12) return 'number_too_short'
    if (!BRAND_LENGTHS[brand].includes(digits.length)) return 'number_length'
    if (!passesLuhn(digits)) return 'number_luhn'
    return null
  })()

  const expiryReason = ((): CardReason | null => {
    if (state.expiry.trim() === '') return 'empty'
    const parsed = parseExpiry(state.expiry)
    if (parsed === null) return 'expiry_format'
    if (parsed.month < 1 || parsed.month > 12) return 'expiry_month'
    if (isExpired(parsed, now)) return 'expiry_past'
    return null
  })()

  const cvcReason = ((): CardReason | null => {
    const c = digitsOnly(state.cvc)
    if (c.length === 0) return 'empty'
    return c.length === cvcLengthFor(brand) ? null : 'cvc_length'
  })()

  const fields: Record<CardField, CardReason | null> = {
    // The name is not validated beyond presence. There is no rule for what a name may contain that does
    // not refuse somebody's real name, and the gateway is the authority on whether it matches the card.
    name: state.name.trim() === '' ? 'empty' : null,
    number: numberReason,
    expiry: expiryReason,
    cvc: cvcReason,
  }

  return { ok: Object.values(fields).every((r) => r === null), fields }
}
