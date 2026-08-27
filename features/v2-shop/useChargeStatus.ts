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
import type { QrDeadlineState } from '@/lib/payment/qr-deadline'
import { RECONCILE_HORIZON_MS, waitPhase, type WaitPhase } from '@/lib/payment/reconcile-window'

// 🔴 #438 — FOUR ANSWERS, NOT THREE. `REJECTED` did not exist, and its absence is the bug: v2_payment has
// three statuses (schema.ts: PENDING/APPROVED/REJECT) and this type had two, so a refused charge arrived
// here and left as 'PENDING'. The screen then said "กำลังดำเนินการ" forever — to a user whose bank had
// already said no, and whose row the server had already marked REJECT.
export type ChargeStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'UNKNOWN'

// `method` (#438) — /api/v2/payment/status:21 already sends it. A REJECT means two different things
// depending on it, and only one of them may use the card copy. See statusOf's caller in result.tsx.
// #455 — `qrDeadline` มาจาก /api/v2/payment/status (slice 1 · #476) และเป็น **optional** ตรงนี้โดยตั้งใจ:
// แถวเก่าที่ค้างอยู่ใน cache ของเบราว์เซอร์ หรือ server ที่ยังไม่ได้ deploy ก็จะไม่มีช่องนี้ ⇒ อ่านได้เป็น
// `undefined` ⇒ ตัวอ่านข้างล่างแปลงเป็น 'unknown' ❌ ไม่ใช่ 'live' และไม่ใช่ 'expired'
// "ไม่ถูกบอก" คือคำตอบที่ถูกต้องสำหรับทั้งสองกรณีนั้น และมันเป็นค่าที่ปลอดภัยที่สุดในสามค่า
//
// 🔴 `liveUntil` ไม่ถูกดึงเข้ามาที่นี่เลย — จอนี้ไม่มี countdown และการมีมันอยู่ในมือคือการเชิญให้เขียน
// `now > liveUntil` ซึ่งเป็นจริงทุกวันระหว่างสอง slow poll โดยที่ QR ยังไม่ตาย (ดู SLOW_POLL_MS ข้างล่าง)
export type PaymentRow = {
  chargeId: string | null
  status: string
  method?: string
  orderId?: string | null
  qrDeadline?: QrDeadlineState
  /**
   * #455 slice 3 — เหตุผลที่แถวจบแบบไม่ได้จ่าย · optional ด้วยเหตุผลเดียวกับ `qrDeadline`:
   * ฝั่ง server เพิ่งเริ่มส่งมัน (mojisejr/mootech-fe#481) ⇒ ระหว่างที่สองฝั่งยัง deploy ไม่พร้อมกัน
   * จอต้องอ่านได้ทั้งตอนมีและตอนไม่มี ❌ ห้ามพังเพราะฟิลด์หาย
   *
   * 🔴 `null` แปลว่า **gateway ไม่ได้บอกเหตุ และเราก็ไม่ได้อนุมานเอง** ❌ ไม่ใช่ "ไม่มีปัญหา"
   */
  failureCode?: string | null
}

/** PURE — the whole selection rule, so it is testable without a timer or a network. */
export function pickCharge(rows: PaymentRow[], chargeId: string): PaymentRow | null {
  return rows.find((r) => r.chargeId === chargeId) ?? null
}

/**
 * PURE — find this user's row by EITHER identifier (#439).
 *
 * 🔴 WHY orderId HAD TO EXIST AS A KEY. A 3-D Secure return_uri must be handed to Omise *before* Omise
 * issues a charge id, so the only identifier we can put in that URL is one we minted ourselves: orderId
 * (lib/payment/charge-flow.ts makeOrderId). The cardholder comes back to /v2/shop/result?order=… with no
 * charge id anywhere, and this is how the screen finds its own row.
 *
 * chargeId wins when both are given: it is the narrower key (unique index on v2_payment.charge_id),
 * while orderId is only unique in practice.
 *
 * 📌 KNOWN, DELIBERATE (ตู๋, review of #448): on a duplicate orderId this takes the first row, while the
 * server's settleAndProvision refuses and returns AMBIGUOUS. The two disagree on purpose — the server is
 * deciding whether money moved, this is only deciding which row to SHOW, and the rows it can see are
 * already scoped to the session user by listUserPayments. Worst case is a user seeing their own other
 * row. Tighten this the day orderId collisions stop being theoretical.
 */
export function pickPayment(rows: PaymentRow[], by: { chargeId?: string | null; orderId?: string | null }): PaymentRow | null {
  if (by.chargeId) {
    const hit = rows.find((r) => r.chargeId === by.chargeId)
    if (hit) return hit
  }
  if (by.orderId) return rows.find((r) => r.orderId === by.orderId) ?? null
  return null
}

/** PURE — what the SCREEN is allowed to say about a row.
 *
 *  🔴 ALLOWLIST, NOT else (#438). The original rule was "anything that is not APPROVED is still waiting",
 *  which correctly stopped the UI claiming success early — and, with it, threw away every failure. Both
 *  halves matter, so the mapping now names the two statuses it understands and sends EVERYTHING ELSE to
 *  'PENDING'. A status string this code has never heard of is therefore still "we are waiting": it is
 *  neither read as success (the original guarantee, scripts/charge-status.test.ts:48-54) nor as failure.
 *
 *  Do not rewrite this as `row.status === 'APPROVED' ? … : row.status === 'REJECT' ? … : …` with the arms
 *  reordered — the point is that the DEFAULT arm is PENDING, whatever new value the DB grows next. */
export function statusOf(row: PaymentRow | null): ChargeStatus {
  if (!row) return 'UNKNOWN'
  if (row.status === 'APPROVED') return 'APPROVED'
  if (row.status === 'REJECT') return 'REJECTED'
  return 'PENDING'
}

/** PURE — is this a state nothing further will change? Used to stop polling AND to stop the screen waiting.
 *  Kept separate from statusOf so both callers read the same rule instead of each spelling it out. */
export function isSettledStatus(s: ChargeStatus): boolean {
  return s === 'APPROVED' || s === 'REJECTED'
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
 *
 * 🔴 RENAMED FROM `STALE_AFTER_MS` (#423). It was never "when to give up" — it is "when to stop asking
 * every three seconds". Giving up happens at RECONCILE_HORIZON_MS, which is twice as far away, because the
 * cron that repairs an unwitnessed payment cannot even START before this instant. Under the old name the
 * screen offered "ขอ QR ใหม่" 0–15 minutes before the repair was allowed to run — to the very user the
 * repair exists for.
 */
export const POLL_UNTIL_MS = 15 * 60 * 1000

/**
 * How often to ask once fast polling is over. The reconciler works on a 15-minute cron, so a 3-second poll
 * buys nothing here — but stopping entirely would mean a successful repair at minute 22 never reaches the
 * screen the user is still looking at.
 */
export const SLOW_POLL_MS = 30_000

export type UseChargeStatus = {
  status: ChargeStatus
  /** #438 — 'card' | 'promptpay' for THIS charge, or null until a row is seen. Only the screen uses it. */
  method: string | null
  polling: boolean
  error: boolean
  /**
   * 🔴 "we can no longer PROMISE a look is pending" — NOT "the repair is over" (#424 review). The cron keeps
   * trying for DEFAULT_WINDOW.windowMs. This flag only unlocks the offer of a new QR for the user who never
   * paid; the same screen must still tell the user who DID pay not to pay twice.
   */
  stale: boolean
  /** which of the three honest things the screen may say — see reconcile-window.waitPhase. */
  phase: WaitPhase
  /** #455 — what the SERVER says about the gateway's deadline. 'unknown' until told, never assumed. */
  qrDeadline: QrDeadlineState
  /** #455 slice 3 — why a finished row ended unpaid. null = we were told nothing, NOT "nothing wrong". */
  failureCode: string | null
  /** one manual poll. Nothing is lost by asking again, so the user is never stuck with our guess. */
  check: () => void
}

export function useChargeStatus(
  // #439 — a string is still accepted (every existing caller passes one). An object lets the result screen
  // ask by orderId, which is the only identifier a 3DS return_uri can carry.
  key: string | null | { chargeId?: string | null; orderId?: string | null },
  {
    pollMs = POLL_MS,
    slowPollMs = SLOW_POLL_MS,
    pollUntilMs = POLL_UNTIL_MS,
    horizonMs = RECONCILE_HORIZON_MS,
    now = () => Date.now(),
  } = {},
): UseChargeStatus {
  // #439 — normalise the two accepted shapes into primitives, so the effect's dep list compares by VALUE.
  // An object literal from the caller would be a new identity every render, i.e. a poll that restarts
  // forever — the same trap the `now` ref below already documents.
  const byChargeId = typeof key === 'string' ? key : (key?.chargeId ?? null)
  const byOrderId = typeof key === 'string' ? null : (key?.orderId ?? null)
  const lookupKey = byChargeId || byOrderId

  const [status, setStatus] = useState<ChargeStatus>('UNKNOWN')
  // #438 — the method the row was actually paid with. A REJECT means "the bank refused this card" or "this
  // QR died"; the screen needs to know which before it picks words. Null until a row for THIS charge is seen.
  const [method, setMethod] = useState<string | null>(null)
  const [qrDeadline, setQrDeadline] = useState<QrDeadlineState>('unknown')
  const [failureCode, setFailureCode] = useState<string | null>(null)
  const [error, setError] = useState(false)
  const [phase, setPhase] = useState<WaitPhase>('waiting')
  const [nonce, setNonce] = useState(0)
  const stopped = useRef(false)
  // The clock is injectable so the deadline is testable without waiting 15 real minutes. Its default is a
  // fresh closure on every render, so it lives in a ref: the effect reads the CURRENT clock without being
  // restarted by its identity — which is what putting it in the dep list would do (one poll restart per
  // render, i.e. a deadline that never arrives).
  const nowRef = useRef(now)
  nowRef.current = now

  useEffect(() => {
    if (!lookupKey) return
    stopped.current = false
    setPhase('waiting')
    const startedAt = nowRef.current()
    let timer: ReturnType<typeof setTimeout> | null = null

    const tick = async () => {
      try {
        const r = await fetch('/api/v2/payment/status')
        if (!r.ok) throw new Error(String(r.status))
        const data = (await r.json()) as { payments?: PaymentRow[] }
        const row = pickPayment(data.payments ?? [], { chargeId: byChargeId, orderId: byOrderId })
        const next = statusOf(row)
        if (stopped.current) return
        setError(false)
        setStatus(next)
        setMethod(row?.method ?? null)
        // ไม่มีแถว หรือแถวไม่มีช่องนี้ = ไม่ถูกบอก ⇒ 'unknown' (ดูเหตุผลที่ PaymentRow ข้างบน)
        setQrDeadline(row?.qrDeadline ?? 'unknown')
        setFailureCode(row?.failureCode ?? null)
        // Settled is settled — stop asking. Everything else keeps waiting: a transient network error must not
        // end the wait, because ending it is indistinguishable on screen from "it failed".
        // 🔴 #438 — REJECTED ends the loop too. A refused charge is as final as a settled one; polling on
        // would burn a request every 30 seconds forever for an answer that can no longer change.
        if (isSettledStatus(next)) return
      } catch {
        if (stopped.current) return
        setError(true)
      }
      if (stopped.current) return
      // 🔴 THREE PHASES, ONE OF WHICH DID NOT EXIST BEFORE #423.
      // `waiting` polls fast; `reconciling` keeps polling slowly because the cron may still settle this row
      // and the user is still on the page; only `exhausted` claims nothing more is coming. Claiming it early
      // is the whole bug: it invited a second payment from someone whose first one had already worked.
      const nextPhase = waitPhase(nowRef.current() - startedAt, pollUntilMs, horizonMs)
      setPhase(nextPhase)
      // 🔴 EVEN `exhausted` KEEPS ASKING (ตู๋, review of #424). The first version returned here, which meant a
      // cron run that could not reach the gateway at minute 20 — and therefore repaired the row at minute 45 —
      // could never reach a screen the user still had open. The reconciler runs for seven days; a poll every
      // 30s costs one request while someone is actually looking. A SETTLED status ends the loop (above —
      // isSettledStatus, which is APPROVED *and* REJECTED since #438), and closing the page ends it via the
      // effect cleanup.
      // 🔴 ประโยคเดิมตรงนี้เขียนว่า "Only APPROVED ends the loop" ซึ่งผิดตั้งแต่ #438 เพิ่ม REJECTED เข้าไป
      // ที่ :83 · assertion ไม่มีทางแดงเพราะไม่มีใครทดสอบคอมเมนต์ · บองชี้ให้ตอน slice 3 (mojisejr/mootech-fe#481)
      // และมันสำคัญกว่าที่เห็น: การที่ loop จบเมื่อ REJECTED คือสาเหตุที่ phase แช่ ซึ่งคือบั๊กที่ slice นี้แก้
      timer = setTimeout(tick, nextPhase === 'waiting' ? pollMs : slowPollMs)
    }
    void tick()

    return () => {
      stopped.current = true
      if (timer) clearTimeout(timer)
    }
  }, [lookupKey, byChargeId, byOrderId, pollMs, slowPollMs, pollUntilMs, horizonMs, nonce])

  const stale = phase === 'exhausted'
  return {
    status,
    method,
    // 🔴 `polling` now means what it says — we ask until the charge settles or the page closes. It no longer
    // goes false at the horizon, because we no longer stop there.
    polling: !!lookupKey && !isSettledStatus(status),
    error,
    stale,
    phase,
    qrDeadline,
    failureCode,
    check: () => setNonce((n) => n + 1),
  }
}
