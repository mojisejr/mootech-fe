// POST /api/bazi/element-summary — proxy to the bazi element-summary endpoint (first-run จอ "ธาตุของคุณ", #233).
// WHY a proxy (same reason as mascot/[ganzhi] + home-fortune): BAZI_BASE_URL is a SERVER env — the browser
// must never see it, so every FE→bazi call goes through a pages/api route.
//
// Graceful by design (มุน's rule 4): any miss (bad input / 4xx / 5xx / timeout / unreachable) → { summary: null }
// with status 200, so the result screen simply HIDES the tagline/traits/advice block — artSrc + facets (which
// come from mascot + element_cycle, NOT this API) still render. This section must never break the whole page.
//
// elementTh split-brain (บอง 2026-08-09): this response DOES carry elementTh, but the screen's element is taken
// from the mascot compute ONLY (same source as home greeting). The caller compares the two and LOGS a mismatch —
// it never silently switches to this one. So the proxy forwards elementTh untouched; the caller decides.
import type { NextApiRequest, NextApiResponse } from 'next'

const BAZI_BASE = process.env.BAZI_BASE_URL || 'http://localhost:3000'
if (/bazichart\.mumate\.co/i.test(BAZI_BASE)) {
  throw new Error(`[GUARDRAIL] BAZI_BASE_URL points at old prod (${BAZI_BASE}).`)
}
const BAZI_TIMEOUT_MS = 12000

/** The bazi person input this screen sends. birthDate is the only required field (bazi defaults the rest). */
export type ElementSummaryPerson = {
  birthDate: string // YYYY-MM-DD
  birthTime?: string // HH:mm (bazi default 12:00)
  gender?: 'female' | 'male' | 'unspecified' // bazi enum (lowercase); default unspecified
  province?: string
}

/** bazi POST /api/bazi/element-summary response — the fields the screen reads. */
export type ElementSummary = {
  dayMaster: string
  dayGanzhi: string
  elementTh: string | null // carried for the caller's split-brain compare/log — NOT the render source
  tagline: string | null
  traits: string[]
  advice: { key: string; label: string; text: string }[]
}

// The proxy result. `reason` distinguishes the two null cases the selector must render DIFFERENTLY
// (#233, ตู๋): collapsing them to a bare `null` made a timed-out reading look like an empty profile —
// a lie about the cause. `unavailable` = we asked and there is genuinely nothing (or we cannot ask yet);
// `error` = we could not find out (transient — a retry might succeed). Never substitute interim copy for `error`.
export type ElementSummaryResult =
  | { summary: ElementSummary }
  | { summary: null; reason: 'unavailable' | 'error' }

/** PURE — map a bazi 200 body to the result. A signalled/garbled body → `error` (couldn't get it);
 *  a clean body with nothing to show → `unavailable` (asked, genuinely empty). Unit-testable. */
export function summaryFromBaziResponse(data: unknown): ElementSummaryResult {
  if (!data || typeof data !== 'object') return { summary: null, reason: 'error' } // non-JSON/garbage
  const d = data as Record<string, unknown>
  if (d.error) return { summary: null, reason: 'error' } // bazi signalled a failure in the body
  const tagline = typeof d.tagline === 'string' ? d.tagline : null
  const traits = Array.isArray(d.traits) ? (d.traits.filter((t) => typeof t === 'string') as string[]) : []
  const advice = Array.isArray(d.advice)
    ? (d.advice.filter(
        (a) => a && typeof a === 'object' && typeof (a as { text?: unknown }).text === 'string',
      ) as ElementSummary['advice'])
    : []
  if (!tagline && traits.length === 0 && advice.length === 0) return { summary: null, reason: 'unavailable' }
  return {
    summary: {
      dayMaster: typeof d.dayMaster === 'string' ? d.dayMaster : '',
      dayGanzhi: typeof d.dayGanzhi === 'string' ? d.dayGanzhi : '',
      elementTh: typeof d.elementTh === 'string' ? d.elementTh : null,
      tagline,
      traits,
      advice,
    },
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const person = (req.body?.person ?? null) as ElementSummaryPerson | null
  // No usable birthDate → we cannot even ask. That is `unavailable` (a missing prerequisite), NOT `error`.
  if (!person || typeof person.birthDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(person.birthDate)) {
    return res.status(200).json({ summary: null, reason: 'unavailable' } satisfies ElementSummaryResult)
  }

  try {
    const ac = new AbortController()
    const timer = setTimeout(() => ac.abort(), BAZI_TIMEOUT_MS)
    const r = await fetch(`${BAZI_BASE}/api/bazi/element-summary`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ person }),
      signal: ac.signal,
    })
    clearTimeout(timer)
    // 4xx/5xx = we could not find out (contract/backend failure) → `error`, never a "nothing here" lie.
    if (!r.ok) return res.status(200).json({ summary: null, reason: 'error' } satisfies ElementSummaryResult)
    const data = (await r.json()) as unknown // a parse throw lands in catch below → also `error`
    return res.status(200).json(summaryFromBaziResponse(data))
  } catch {
    // timeout / unreachable / parse failure → `error` (transient; a retry might succeed). Never throw at the user.
    return res.status(200).json({ summary: null, reason: 'error' } satisfies ElementSummaryResult)
  }
}
