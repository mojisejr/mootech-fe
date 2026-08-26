// The quote computation shared by preview and charge (mootech-fe#361) — ONE function, two callers, so the
// two can never disagree about the money (ตู๋ T6/B3). preview writes the result into payment_quote; charge
// recomputes with this same function and COMPARES against the stored quote.
import { quotePackage, UnsellablePackageError } from '@/lib/payment/catalog'
import type { TierCode } from '@/lib/v2/tier'
import { getPackage } from '@/lib/payment/repo'
import { codeApplies, quoteWithCode, type DiscountCodeSpec } from './rules'
import { getCodeByString, findLegacyCode, toSpec, type DiscountCodeRow } from './repo'

// #355 pinned VAT at 0 until app_setting exists (#362). Kept as one named constant so #362 has a single
// place to swap — and so preview/charge quote the SAME rate today.
export const VAT_PERCENT = 0

export type PriceResult =
  | {
      ok: true
      packageCode: string
      // #456 — NARROWED from `string`. quotePackage (lib/payment/catalog.ts:78-81) already refuses anything
      // that is not a named PAID tier before returning, so `string` was always wider than the value. The
      // repurchase gate compares this against the ladder and must not be handed an unplaceable string.
      tierCode: TierCode
      expire: string
      bufferDay: number
      listSatang: number
      discountSatang: number
      amountSatang: number
      vatSatang: number
      vatPercent: number
      code: DiscountCodeRow | null
      codeSpec: DiscountCodeSpec | null
    }
  | { ok: false; status: 400; error: string; codeError?: 'INVALID' | 'LEGACY_CODE' | 'STATUS' | 'WINDOW' | 'NOT_APPLICABLE' | 'BELOW_MIN' }

// Price a package (+ optional code string) entirely server-side. A code that cannot be honoured REFUSES the
// request with a reason — it never silently prices at full (an unknown value must not become a valid
// outcome), so the screen can show "โค้ดใช้ไม่ได้" instead of quietly charging more than the user expects.
export async function priceFor(packageCode: string, codeStr: string | null, now: Date): Promise<PriceResult> {
  const pkg = await getPackage(packageCode)
  if (!pkg) return { ok: false, status: 400, error: 'unknown package_code' }

  let base
  try {
    base = quotePackage(pkg) // list price + tier + frozen duration; throws on an unsellable package
  } catch (e) {
    if (e instanceof UnsellablePackageError) return { ok: false, status: 400, error: 'package is not available' }
    throw e
  }

  const common = {
    ok: true as const,
    packageCode: base.packageCode,
    tierCode: base.tierCode,
    expire: pkg.expire,
    bufferDay: pkg.bufferDay,
    listSatang: base.amountSatang,
    vatPercent: VAT_PERCENT,
  }

  if (!codeStr) {
    return {
      ...common,
      discountSatang: 0,
      amountSatang: base.amountSatang,
      vatSatang: base.vatSatang,
      code: null,
      codeSpec: null,
    }
  }

  const row = await getCodeByString(codeStr)
  if (!row) {
    // Not a discount code — but it may be a v1 payment_code (a free-package grant). Say so, because telling
    // a real code-holder "invalid code" is wrong and is exactly what the DoD forbids. The v2 payment lane
    // cannot redeem it (that path is v1's), so we refuse the CHARGE but with the honest reason.
    const legacy = await findLegacyCode(codeStr)
    if (legacy) {
      return {
        ok: false,
        status: 400,
        error: 'this code is a v1 package code — redeem it on the old membership flow, not as a discount',
        codeError: 'LEGACY_CODE',
      }
    }
    return { ok: false, status: 400, error: 'invalid code', codeError: 'INVALID' }
  }

  const spec = toSpec(row)
  const applies = codeApplies(spec, packageCode, now)
  if (!applies.ok) return { ok: false, status: 400, error: 'code cannot be used', codeError: applies.reason }

  const lines = quoteWithCode({ listSatang: base.amountSatang, code: spec, vatPercent: VAT_PERCENT })
  if (!lines.ok) {
    return { ok: false, status: 400, error: 'code cannot be used on this amount', codeError: lines.reason }
  }

  return {
    ...common,
    discountSatang: lines.discountSatang,
    amountSatang: lines.amountSatang,
    vatSatang: lines.vatSatang,
    code: row,
    codeSpec: spec,
  }
}
