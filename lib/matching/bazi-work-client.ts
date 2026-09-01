// I/O adapter for the bazi WORK endpoint — the colleague lane's engine call (mootech-fe#585).
// Sibling of ./bazi-client (pair-match); same two deliberate properties, for the same reasons:
//   1. BAZI_BASE_URL + the old-prod guardrail every FE→bazi proxy carries.
//   2. 🔴 It THROWS and the caller does NOT fall back. A failure here must reach the user as "we could not
//      compute", never as "โควตาเต็ม", and must never charge a quota unit (#263's shape).
//
// 🔴 THE TIMEOUT IS NOT THE PAIR LANE'S. A measured 3-candidate call took 8.4s (mojisejr/mootech-fe#585,
// yielding ~7MB). The pair default of 12s leaves 3.6s of headroom for a call that already runs 3 charts,
// so this lane gets its own budget and its own env var. Reusing BAZI_PAIR_TIMEOUT_MS would have coupled a
// 1-chart call and a 3-chart call to one number, and the next person to lower it for the fast lane would
// have silently broken this one.
//
// 🔴 MAX_CANDIDATES = 3 IS THE ENGINE'S NUMBER, NOT OURS. bazi-sft-dataset
// `src/app/api/bazi/work/route.ts:13` (branch `pdf-dev` — that repo's `main` is 3 months stale and does
// not contain this file) rejects more than 3 with a 400. The constant is mirrored here so the screen can
// refuse locally with a sentence instead of spending a round trip to be told the same thing.
import { BaziEngineError } from './bazi-client'

const BAZI_BASE = process.env.BAZI_BASE_URL || 'http://localhost:3000'
if (/bazichart\.mumate\.co/i.test(BAZI_BASE)) {
  throw new Error(`[GUARDRAIL] BAZI_BASE_URL points at old prod (${BAZI_BASE}).`)
}

/** The engine's own ceiling (route.ts:13 on pdf-dev). Figma locks the form to 3 slots to match. */
export const MAX_CANDIDATES = 3

const DEFAULT_WORK_TIMEOUT_MS = 20000

export function getBaziWorkTimeoutMs(): number {
  const n = Number(process.env.BAZI_WORK_TIMEOUT_MS)
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_WORK_TIMEOUT_MS
}

export type BaziRawInput = {
  birthDate: string
  birthTime: string
  gender: string
  province: string
  calendarSystem?: string
  timezone?: string
}

export type BaziWorkRequest = { self: BaziRawInput; candidates: BaziRawInput[] }

/**
 * POST /api/bazi/work.
 *
 * Returns the WHOLE body — trimming is a separate, pure step
 * (`features/v2-service/work-comparison.ts#trimWorkResponse`) so the cut has teeth of its own and this
 * file stays a transport with nothing to reason about.
 */
export async function fetchBaziWork(
  req: BaziWorkRequest,
  baseUrl: string = BAZI_BASE,
  timeoutMs: number = getBaziWorkTimeoutMs(),
): Promise<unknown> {
  if (req.candidates.length < 1) throw new BaziEngineError('bazi work called with no candidates')
  if (req.candidates.length > MAX_CANDIDATES) {
    throw new BaziEngineError(`bazi work accepts at most ${MAX_CANDIDATES} candidates, got ${req.candidates.length}`)
  }
  const url = `${baseUrl.replace(/\/+$/, '')}/api/bazi/work`
  const ac = new AbortController()
  const timer = setTimeout(() => ac.abort(), timeoutMs)
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(req),
      signal: ac.signal,
    })
    if (!r.ok) throw new BaziEngineError(`bazi work HTTP ${r.status}`)
    return await r.json()
  } catch (e) {
    if (e instanceof BaziEngineError) throw e
    throw new BaziEngineError(`bazi work unreachable: ${(e as Error)?.message ?? String(e)}`)
  } finally {
    clearTimeout(timer)
  }
}
