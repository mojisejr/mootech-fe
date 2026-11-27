// แผนชีวิตปีใหม่ 2570 — the unlock offers. The full plan is a bonus of a YEARLY plan (owner's decision,
// team meeting 2026-11-24 item 13), so the offers are the two yearly packages and nothing here touches the
// payment lane. The price is payment_package's (features/v2-shop/packages.ts: no price is typed into a
// screen). A discount code, when the owner runs one, comes from the server env, so no code name sits in
// this public repository. With no code, or a malformed one, the link sells at list price.
export type NewYearOffer = { packageCode: string; price: number | null; discounted: boolean; href: string }
export type PackageRow = { amount?: unknown; is_active?: unknown } | null

export const NEWYEAR_PLUS_PACKAGE = 'V2_PLUS_YEARLY'
export const NEWYEAR_PRO_PACKAGE = 'V2_PRO_YEARLY'
const CODE_RE = /^[A-Za-z0-9_-]{3,40}$/

export function newYearOffer(row: PackageRow, code: string | undefined, packageCode: string = NEWYEAR_PLUS_PACKAGE): NewYearOffer {
  const ok = typeof code === 'string' && CODE_RE.test(code.trim())
  const amount = row && row.is_active !== false ? Number(row.amount) : NaN
  const price = Number.isFinite(amount) && amount > 0 ? Math.round(amount) : null
  const q = new URLSearchParams({ package_code: packageCode })
  if (ok) q.set('code', (code as string).trim())
  return { packageCode, price, discounted: ok, href: `/v2/shop/checkout?${q.toString()}` }
}
