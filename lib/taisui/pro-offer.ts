// ปีชง 2570 (revision 0.14): the Pro yearly offer at the end of the page. The price is payment_package's
// (features/v2-shop/packages.ts: no price is typed into a screen); the discount code is the owner's and comes
// from the server env TAISUI_PRO_CODE, so no code name sits in this public repository. With no code, or a
// malformed one, the page sells Pro at its list price.
import type { ProOffer } from '@/features/v2-taisui/components/taisui-motion'

export const TAISUI_PRO_PACKAGE = 'V2_PRO_YEARLY'
const CODE_RE = /^[A-Za-z0-9_-]{3,40}$/

export function proOfferFrom(row: { amount?: unknown; is_active?: unknown } | null, code: string | undefined): ProOffer {
  const ok = typeof code === 'string' && CODE_RE.test(code.trim())
  const amount = row && row.is_active !== false ? Number(row.amount) : NaN
  const price = Number.isFinite(amount) && amount > 0 ? Math.round(amount) : null
  const q = new URLSearchParams({ package_code: TAISUI_PRO_PACKAGE })
  if (ok) q.set('code', (code as string).trim())
  return { href: `/v2/shop/checkout?${q.toString()}`, price, discounted: ok }
}
