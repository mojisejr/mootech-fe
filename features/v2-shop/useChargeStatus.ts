// features/v2-shop/useChargeStatus.ts — "did the charge I just created actually settle?" (mootech-fe#363).
//
// The QR screen and the result screen both need this, and neither may guess. A charge is created by
// /api/v2/payment/charge | promptpay, which answers `{ chargeId, status: 'PENDING', … }`. It becomes APPROVED
// only when Omise's webhook reaches us and the DB settles it (lib/payment/repo.ts settleV2Payment). Until
// then the honest thing on screen is "waiting", never "done".
//
// 🔴 FIND THE ROW BY chargeId. NEVER payments[0].
// GET /api/v2/payment/status returns the user's WHOLE payment list, newest first (repo.ts:173-188 —
// `orderBy(desc(createdAt))`, no `.limit`). Taking the first row would be right almost every time: it is the
// newest, and usually the newest is the one we just made. "Almost every time" is the worst possible failure
// profile — two tabs, or a retry after a refused card, create two rows, and the screen would report on
// somebody else's charge while looking completely normal. Wrong-always gets found on day one; wrong-rarely
// ships.
//
// 🔴 AND THE ABSENCE OF `.limit` IS A DEPENDENCY, NOT A COINCIDENCE (บอง #363).
// This hook only works because that query returns every row. The day someone adds `.limit(20)` for a perfectly
// good reason, a user with 20 older payments stops finding their new charge — and the failure is SILENT: the
// screen just waits forever. scripts/charge-status.test.ts pins it so that edit goes red instead.
import { useEffect, useRef, useState } from 'react'

export type ChargeStatus = 'PENDING' | 'APPROVED' | 'UNKNOWN'

export type PaymentRow = { chargeId: string | null; status: string }

/** PURE — the whole selection rule, so it is testable without a timer or a network. */
export function pickCharge(rows: PaymentRow[], chargeId: string): PaymentRow | null {
  return rows.find((r) => r.chargeId === chargeId) ?? null
}

/** PURE — what the SCREEN is allowed to say about a row. Anything that is not a settled APPROVED is
 *  "still waiting"; there is no third answer that lets the UI claim success early. */
export function statusOf(row: PaymentRow | null): ChargeStatus {
  if (!row) return 'UNKNOWN'
  return row.status === 'APPROVED' ? 'APPROVED' : 'PENDING'
}

export const POLL_MS = 3000

/**
 * 🔴 OUR NUMBER, NOT OMISE'S — and the UI says "อาจ" because of that (#363 criteria, 2026-08-23).
 *
 * The PromptPay response carries `chargeId` and the QR image and NOTHING about when the QR dies
 * (omise-gateway.ts:71-74 reads only `source.scannable_code.image.download_uri`). The only deadline this
 * system actually holds is the quote TTL — 15 minutes (pages/api/v2/payment/preview.ts:14) — and that one is
 * already spent by the time a charge exists. So this is not "when the QR expires". It is "how long we keep
 * asking before we admit we do not know", and it is deliberately the same 15 minutes rather than a tenth
 * invented number. If the gateway ever forwards Omise's own `expires_at`, a real countdown becomes possible
 * and the word "อาจ" can come off the screen.
 */
export const STALE_AFTER_MS = 15 * 60 * 1000

export type UseChargeStatus = {
  status: ChargeStatus
  polling: boolean
  error: boolean
  /** past the deadline with no settle — the screen offers "ตรวจสอบอีกครั้ง" / "ขอ QR ใหม่" instead of claiming. */
  stale: boolean
  /** one manual poll. Nothing is lost by asking again, so the user is never stuck with our guess. */
  check: () => void
}

export function useChargeStatus(
  chargeId: string | null,
  { pollMs = POLL_MS, staleAfterMs = STALE_AFTER_MS, now = () => Date.now() } = {},
): UseChargeStatus {
  const [status, setStatus] = useState<ChargeStatus>('UNKNOWN')
  const [error, setError] = useState(false)
  const [stale, setStale] = useState(false)
  const [nonce, setNonce] = useState(0)
  const stopped = useRef(false)

  useEffect(() => {
    if (!chargeId) return
    stopped.current = false
    setStale(false)
    const startedAt = now()
    let timer: ReturnType<typeof setTimeout> | null = null

    const tick = async () => {
      try {
        const r = await fetch('/api/v2/payment/status')
        if (!r.ok) throw new Error(String(r.status))
        const data = (await r.json()) as { payments?: PaymentRow[] }
        const next = statusOf(pickCharge(data.payments ?? [], chargeId))
        if (stopped.current) return
        setError(false)
        setStatus(next)
        // Settled is settled — stop asking. Everything else keeps waiting: a transient network error must not
        // end the wait, because ending it is indistinguishable on screen from "it failed".
        if (next === 'APPROVED') return
      } catch {
        if (stopped.current) return
        setError(true)
      }
      // Past the deadline we STOP ASKING but claim nothing: not expired, not failed. The screen switches to
      // "อาจหมดอายุ" plus a manual check, because a user who paid at minute 20 must still be able to find out.
      if (!stopped.current && now() - startedAt >= staleAfterMs) {
        setStale(true)
        return
      }
      if (!stopped.current) timer = setTimeout(tick, pollMs)
    }
    void tick()

    return () => {
      stopped.current = true
      if (timer) clearTimeout(timer)
    }
  }, [chargeId, pollMs, staleAfterMs, nonce])

  return {
    status,
    polling: !!chargeId && status !== 'APPROVED' && !stale,
    error,
    stale,
    check: () => setNonce((n) => n + 1),
  }
}
