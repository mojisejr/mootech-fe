// PURE mappers for the first-run element source (#233 C2). React-free / API-free (type-only imports)
// so scripts/first-run-source.test.ts can run them in the plain-tsx lane without dragging React in.
import type {
  ElementCycleRow,
  AsyncState,
  ElementSummary,
} from '@/features/v2-first-run/components/ElementResultScreen'

/** chart.elementCycle IS the DB element_cycle row, joined server-side by (element, power, gender).
 *  Missing / not-an-object (e.g. gender missing ⇒ no join) → `unavailable` (a real answer, not error). */
export function cycleFromChart(elementCycle: unknown): AsyncState<ElementCycleRow> {
  if (!elementCycle || typeof elementCycle !== 'object') return { status: 'unavailable' }
  const r = elementCycle as Record<string, unknown>
  const s = (k: string) => (typeof r[k] === 'string' ? (r[k] as string) : '')
  return {
    status: 'ready',
    data: {
      power: s('power'),
      friend: s('element_friend'),
      work: s('element_work'),
      career: s('element_career'),
      fortune: s('element_fortune'),
      spouse: s('element_spouse'),
      supporter: s('element_supporter'),
    },
  }
}

type SummaryBody = {
  summary?: {
    tagline?: string | null
    traits?: string[]
    advice?: { key: string; label: string; text: string }[]
    elementTh?: string
  } | null
  reason?: 'unavailable' | 'error'
}

/** Map the summary proxy's (ok, body) to AsyncState. THE load-bearing distinction (ตู๋, #233):
 *  a transport failure (!ok) or `reason:'error'` → `error` ("could not find out"), NEVER `unavailable`.
 *  `reason:'unavailable'` (missing dob / genuinely empty) stays `unavailable`. Conflating them makes a
 *  timed-out reading read as "your profile is incomplete" — a lie about the cause. */
export function summaryStateFromResponse(ok: boolean, body: unknown): AsyncState<ElementSummary> {
  if (!ok || !body || typeof body !== 'object') return { status: 'error' }
  const b = body as SummaryBody
  if (b.summary) {
    return {
      status: 'ready',
      data: {
        tagline: b.summary.tagline ?? '',
        traits: b.summary.traits ?? [],
        advice: b.summary.advice ?? [],
        elementTh: b.summary.elementTh,
      },
    }
  }
  return { status: b.reason === 'error' ? 'error' : 'unavailable' }
}

export function toBaziGender(g: unknown): 'male' | 'female' | 'unspecified' {
  const s = String(g ?? '').toUpperCase()
  return s === 'FEMALE' ? 'female' : s === 'MALE' ? 'male' : 'unspecified'
}
