// I/O adapter for the bazi pair-match engine (#357). The ONLY side-effecting part of the compute:
// a read-only HTTP POST to /api/bazi/pair-match. Ported from mootech-be
// src/matching/bazi/bazi-pair-match.adapter.ts, with two deliberate differences:
//
//   1. It uses the FE's BAZI_BASE_URL convention + the old-prod guardrail every other FE→bazi proxy
//      carries (pages/api/bazi/element-summary.ts:14-17, pages/api/bazi/mascot/[ganzhi].ts:13-15).
//   2. 🔴 It THROWS, and the caller does NOT fall back. On be, a bazi failure silently falls back to the
//      legacy table compute (chinese-horoscope.service.ts:1085-1092 catches, returns null, and the caller
//      computes from the legacy tables). FE has no legacy tables, and #357's DoD asks for the opposite:
//      the user must see a message they can tell apart from "โควตาเต็ม". So a failure here becomes an
//      explicit engine error at the route — never a quota answer, and never a silent charge of quota.
import type { BaziPairMatchRequest, BaziPairMatchResponse } from './bazi-pair-match.types'

const BAZI_BASE = process.env.BAZI_BASE_URL || 'http://localhost:3000'
if (/bazichart\.mumate\.co/i.test(BAZI_BASE)) {
  throw new Error(`[GUARDRAIL] BAZI_BASE_URL points at old prod (${BAZI_BASE}).`)
}

const DEFAULT_TIMEOUT_MS = 12000

export function getBaziPairTimeoutMs(): number {
  const n = Number(process.env.BAZI_PAIR_TIMEOUT_MS)
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_TIMEOUT_MS
}

/** Marks "the engine did not answer" so the route can say so instead of guessing at the cause. */
export class BaziEngineError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'BaziEngineError'
  }
}

// POST the request to the bazi pair-match endpoint. Throws BaziEngineError on timeout / non-2xx /
// unreachable / unparseable — every one of which means "we could not compute", never "you are out".
export async function fetchBaziPairMatch(
  req: BaziPairMatchRequest,
  baseUrl: string = BAZI_BASE,
  timeoutMs: number = getBaziPairTimeoutMs(),
): Promise<BaziPairMatchResponse> {
  const url = `${baseUrl.replace(/\/+$/, '')}/api/bazi/pair-match`
  const ac = new AbortController()
  const timer = setTimeout(() => ac.abort(), timeoutMs)
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(req),
      signal: ac.signal,
    })
    if (!r.ok) {
      throw new BaziEngineError(`bazi pair-match HTTP ${r.status}`)
    }
    return (await r.json()) as BaziPairMatchResponse
  } catch (e) {
    if (e instanceof BaziEngineError) throw e
    throw new BaziEngineError(`bazi pair-match unreachable: ${(e as Error)?.message ?? String(e)}`)
  } finally {
    clearTimeout(timer)
  }
}
