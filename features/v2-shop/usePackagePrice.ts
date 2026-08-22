// v2 shop — read a plan's price from the server (mootech-fe#359, Phase 7).
//
// 🔴 The price NEVER lives in the screen (DoD): the card asks /api/payment-package for the package_code it
// sells and renders whatever comes back. `pages/api/payment-package.ts:12-14` answers ONE code at a time
// (WHERE package_code = $code LIMIT 1) and returns the row or `null` with status 200.
//
// 🔴 Four outcomes, four names — NOT `number | null`.
// A nullable price would have to mean "still loading" AND "this plan has no code yet" AND "the row is
// missing" AND "the request failed", and the card would end up guessing which. The card must say something
// different to the user in each case (a spinner is not the same sentence as "ยังไม่เปิดขาย", and neither is
// an apology for our own outage), so the type carries the distinction instead of the component inferring it.
import { useEffect, useState } from 'react'

export type PriceState =
  /** No package_code backs this plan/period yet (Pro today, every annual code today — #359 B2/B3). */
  | { kind: 'unsellable' }
  /** Request in flight. */
  | { kind: 'loading' }
  /** The server answered with a row. `amountThb` is payment_package.amount (THB, a float). */
  | { kind: 'ready'; amountThb: number }
  /** The server answered 200 with `null` — the code has no row. A data gap, not our outage. */
  | { kind: 'missing' }
  /** The request itself failed (network / 5xx). Ours to apologise for, not the user's fault. */
  | { kind: 'error' }

/**
 * Fetch the price for `code`. Pass `null` when the plan has nothing sellable — the hook then reports
 * `unsellable` without touching the network.
 */
export function usePackagePrice(code: string | null): PriceState {
  const [state, setState] = useState<PriceState>(code === null ? { kind: 'unsellable' } : { kind: 'loading' })

  useEffect(() => {
    if (code === null) {
      setState({ kind: 'unsellable' })
      return
    }
    let alive = true
    setState({ kind: 'loading' })
    fetch(`/api/payment-package?code=${encodeURIComponent(code)}`, { credentials: 'same-origin' })
      .then(async (res) => {
        // A non-2xx is our failure, not a data gap: keep them apart so the card can too.
        if (!res.ok) throw new Error(`payment-package ${res.status}`)
        return (await res.json()) as { amount?: number } | null
      })
      .then((row) => {
        if (!alive) return
        const amount = row?.amount
        // The endpoint answers 200 + `null` for an unknown code — that is "missing", not "error".
        if (row === null || amount == null || !Number.isFinite(Number(amount))) {
          setState({ kind: 'missing' })
          return
        }
        setState({ kind: 'ready', amountThb: Number(amount) })
      })
      .catch(() => {
        if (alive) setState({ kind: 'error' })
      })
    return () => {
      alive = false
    }
  }, [code])

  return state
}

/** ฿-formatted amount, grouped, no trailing .00 — matches the design's ฿790 / ฿1,590. */
export function formatThb(amountThb: number): string {
  return `฿${amountThb.toLocaleString('th-TH', { maximumFractionDigits: 2 })}`
}
