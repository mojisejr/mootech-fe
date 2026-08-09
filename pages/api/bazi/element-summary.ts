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

/** PURE — a bazi response is usable only if it is an object without an `error` and with a tagline OR traits OR
 *  advice to show. Anything else → null so the block hides. Keeps the "no data = no show" rule unit-testable. */
export function summaryFromBaziResponse(data: unknown): { summary: ElementSummary | null } {
  if (!data || typeof data !== 'object') return { summary: null }
  const d = data as Record<string, unknown>
  if (d.error) return { summary: null }
  const tagline = typeof d.tagline === 'string' ? d.tagline : null
  const traits = Array.isArray(d.traits) ? (d.traits.filter((t) => typeof t === 'string') as string[]) : []
  const advice = Array.isArray(d.advice)
    ? (d.advice.filter(
        (a) => a && typeof a === 'object' && typeof (a as { text?: unknown }).text === 'string',
      ) as ElementSummary['advice'])
    : []
  if (!tagline && traits.length === 0 && advice.length === 0) return { summary: null } // nothing to show → hide
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
  // birthDate is the one field bazi cannot default — no dob, nothing to compute → hide the block.
  if (!person || typeof person.birthDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(person.birthDate)) {
    return res.status(200).json({ summary: null })
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
    if (!r.ok) return res.status(200).json({ summary: null }) // 4xx (bad input) / 5xx → hide block
    const data = (await r.json()) as unknown
    return res.status(200).json(summaryFromBaziResponse(data))
  } catch {
    return res.status(200).json({ summary: null }) // timeout / unreachable → hide block, never throw at the user
  }
}
