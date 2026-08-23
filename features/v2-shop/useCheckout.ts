// features/v2-shop/useCheckout.ts — the checkout state machine (mootech-fe#363).
//
// 🔴 THE SCREEN NEVER PRICES ANYTHING. Every amount comes from POST /api/v2/payment/preview, and every
// re-price (apply a code, clear a code) is another call — not an edit to numbers already on screen. That is
// why `clear` re-fetches instead of subtracting: a discount removed locally would leave a total that agrees
// with nothing the server will charge.
//
// 🔴 A REFUSED CODE MUST NOT DESTROY THE PRICE. preview refuses a bad code with a 4xx (`codeError`), and the
// naive handling — set quote to null — blanks the summary the user was reading and makes a typo look like an
// outage. So a code failure updates the CODE state only; the last good quote stays on screen.
import { useCallback, useEffect, useState } from 'react'
import type { Quote } from './components/OrderSummaryCard'
import type { DiscountState } from './components/DiscountCodeField'

type PreviewResponse = Quote & { quoteId: string; expiresAt: string }

export type CheckoutState = {
  quote: (Quote & { quoteId: string }) | null
  loading: boolean
  /** the whole-screen failure: we could not price the package at all. A code error is NOT this. */
  fatal: boolean
  code: string
  codeState: DiscountState
  codeError?: string
  busy: boolean
  setCode: (v: string) => void
  applyCode: () => void
  clearCode: () => void
}

/** Server reasons → the sentence a human reads. Unknown reasons fall back to the design's line rather than
 *  leaking an enum onto a payment screen. */
const CODE_REASON: Record<string, string> = {
  INVALID: 'โค้ดไม่ถูกต้องหรือหมดอายุแล้ว',
  LEGACY_CODE: 'โค้ดนี้ใช้กับแพ็กเกจเดิมเท่านั้น',
  STATUS: 'โค้ดนี้ถูกปิดใช้งานแล้ว',
  WINDOW: 'โค้ดนี้ยังไม่เริ่มใช้ หรือหมดเวลาแล้ว',
  NOT_APPLICABLE: 'โค้ดนี้ใช้กับแพ็กเกจนี้ไม่ได้',
  BELOW_MIN: 'ยอดยังไม่ถึงขั้นต่ำของโค้ดนี้',
}

export function useCheckout(packageCode: string): CheckoutState {
  const [quote, setQuote] = useState<(Quote & { quoteId: string }) | null>(null)
  const [loading, setLoading] = useState(true)
  const [fatal, setFatal] = useState(false)
  const [code, setCode] = useState('')
  const [codeState, setCodeState] = useState<DiscountState>('default')
  const [codeError, setCodeError] = useState<string | undefined>(undefined)
  const [busy, setBusy] = useState(false)

  const price = useCallback(async (withCode: string | null) => {
    const first = withCode === null
    if (first) setLoading(true)
    else setBusy(true)
    try {
      const r = await fetch('/api/v2/payment/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ package_code: packageCode, ...(withCode ? { code: withCode } : {}) }),
      })
      const data = (await r.json()) as Partial<PreviewResponse> & { codeError?: string; error?: string }
      if (!r.ok) {
        if (withCode) {
          // A code we cannot honour. The PRICE the user was looking at is still valid — keep it.
          setCodeState('error')
          setCodeError(CODE_REASON[String(data.codeError)] ?? undefined)
          return
        }
        setFatal(true)
        return
      }
      setQuote(data as Quote & { quoteId: string })
      setFatal(false)
      setCodeState(data.codeApplied ? 'success' : 'default')
      setCodeError(undefined)
    } catch {
      // A network failure while pricing a package is fatal to the screen; while applying a code it is not.
      if (withCode) { setCodeState('error'); setCodeError(undefined) } else setFatal(true)
    } finally {
      setLoading(false)
      setBusy(false)
    }
  }, [packageCode])

  useEffect(() => { void price(null) }, [price])

  return {
    quote, loading, fatal, code, codeState, codeError, busy,
    setCode: (v: string) => { setCode(v); if (codeState === 'error') { setCodeState('default'); setCodeError(undefined) } },
    applyCode: () => { void price(code.trim()) },
    // ✕ — re-price WITHOUT the code. Never a local subtraction (see the header).
    clearCode: () => { setCode(''); void price(null) },
  }
}
