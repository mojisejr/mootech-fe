// BFF for the Zone-1 daily-fortune card. Browser → this route (same-origin) → bazi POST /api/home.
// WHY a proxy (verified — every bazi call in FE goes this way): BAZI_BASE_URL is a SERVER env (never
// shipped to the browser), birth data must not leave to a 3rd origin, and there is no browser→bazi CORS.
//
// Normalizes the bazi manvsday `fortune` to the `DailyFortune` shape the UI consumes. Graceful by
// design: no person / bazi unreachable / bazi error → { fortune: null } (200) so the hook shows its
// fallback and the page never breaks — never a 5xx to the browser (same policy as the other bazi BFFs).
//
// NOTE (contract gap, verified): bazi /api/home currently returns fortune = {percent, verdict, summary,
// date, dayGanzhi, facets[]} and DROPS grade + summaryHeadline + summaryItems (buildManVsDay computes
// them). Until bazi forwards them, we normalize here: headline ← summaryHeadline ?? summary; best/worst
// ← summaryItems (rich text) else derived from facets by percent; grade ← fortune.grade (bazi is the
// single source of the ratingJson thresholds — we do NOT reimplement gradeForPercent to avoid drift).
import type { NextApiRequest, NextApiResponse } from 'next'
import { toBaziInput, type FeCalcInput } from '@/lib/bazi-bridge/input'

const BAZI_BASE = process.env.BAZI_BASE_URL || 'http://localhost:3000'
if (/bazichart\.mumate\.co/i.test(BAZI_BASE)) {
  throw new Error(`[GUARDRAIL] BAZI_BASE_URL points at old prod (${BAZI_BASE}).`)
}
const BAZI_TIMEOUT_MS = 12000

export type DailyFortune = {
  percent: number
  grade: string // gradeForPercent(percent) — from bazi (single-sourced ratingJson); '' until forwarded
  verdict: 'good' | 'neutral' | 'caution'
  headline: string
  date: string
  best: { text: string } // ⭐ เหมาะกับวันนี้ (facet %สูงสุด)
  worst: { text: string } // ⚠️ ควรเลี่ยง (facet %ต่ำสุด)
}

type Facet = { key: string; label: string; percent: number | null; grade: string; isMain: boolean }
type SummaryItem = { key: string; icon: string; label: string; text: string }

function bestWorstText(f: { summaryItems?: SummaryItem[]; facets?: Facet[] }): { best: string; worst: string } {
  // Prefer bazi's pre-computed summaryItems (rich ⭐/⚠️ text). Fallback: derive from facets by percent.
  if (Array.isArray(f.summaryItems) && f.summaryItems.length >= 2) {
    return { best: f.summaryItems[0]?.text ?? '', worst: f.summaryItems[f.summaryItems.length - 1]?.text ?? '' }
  }
  const scored = (f.facets ?? []).filter((x) => x.percent != null)
  if (!scored.length) return { best: '', worst: '' }
  const best = scored.reduce((a, c) => ((c.percent ?? 0) > (a.percent ?? 0) ? c : a))
  const worst = scored.reduce((a, c) => ((c.percent ?? 0) < (a.percent ?? 0) ? c : a))
  return { best: best.label, worst: worst.label }
}

export function normalize(fortune: unknown): DailyFortune | null {
  const f = fortune as {
    percent?: unknown; grade?: unknown; verdict?: unknown; summary?: unknown
    summaryHeadline?: unknown; date?: unknown; summaryItems?: SummaryItem[]; facets?: Facet[]
  } | null
  // percent is the ground-truth field the card cannot render without — no percent → no card.
  if (!f || typeof f.percent !== 'number') return null
  const { best, worst } = bestWorstText(f)
  return {
    percent: f.percent,
    grade: typeof f.grade === 'string' ? f.grade : '',
    verdict: (f.verdict === 'good' || f.verdict === 'caution' ? f.verdict : 'neutral'),
    headline: (typeof f.summaryHeadline === 'string' && f.summaryHeadline) || (typeof f.summary === 'string' ? f.summary : ''),
    date: typeof f.date === 'string' ? f.date : '',
    best: { text: best },
    worst: { text: worst },
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const { person, anonId } = (req.body ?? {}) as { person?: FeCalcInput; anonId?: string }
  if (!person) return res.status(200).json({ fortune: null }) // no birth data → graceful skip (card hidden)

  try {
    const { rawInput } = toBaziInput(person) // reuse the FE→bazi person mapper (birthDate/time/gender/province)
    const ac = new AbortController()
    const timer = setTimeout(() => ac.abort(), BAZI_TIMEOUT_MS)
    const r = await fetch(`${BAZI_BASE}/api/home`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // anonId only feeds bazi's manifest queries (goals/streak/wallet) — irrelevant to the fortune,
      // but the schema requires a non-empty value; a stable placeholder is fine for the fortune card.
      body: JSON.stringify({ anonId: anonId || 'home-fortune', person: rawInput }),
      signal: ac.signal,
    })
    clearTimeout(timer)
    if (!r.ok) return res.status(200).json({ fortune: null }) // bazi 4xx/5xx → graceful, page holds
    const data = (await r.json()) as { fortune?: unknown }
    return res.status(200).json({ fortune: normalize(data.fortune) })
  } catch {
    return res.status(200).json({ fortune: null }) // timeout/unreachable → graceful
  }
}
