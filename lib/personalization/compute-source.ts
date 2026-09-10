import { type ComputeMascotSource } from '@/lib/personalization/mascot'

// The greeting ธาตุ element string — the day-master element the home header shows.
// SOURCE OF TRUTH = bazi's persona (pdf-dev, the SAME engine as หน้า "ดวงของฉัน" via /api/destiny),
// computed live from the current user row each home load. It does NOT fall back to the mootech-be
// compute (ChineseHoroscopeGet → NEXT_PUBLIC_BACKEND_URL): the two engines disagree on the day-master
// element (different solar-term/time handling) AND the mootech-be chart is served via a `result_code`
// pointer that goes STALE after an edit-birth — so the compute value could be WRONG and mismatch
// ดวงของฉัน. Showing a stale/other-engine element even for one frame is worse than showing none, so
// while persona is still loading (or the engine is down) this returns null and the row stays hidden.
// `_computeSource` is kept only for call-site compatibility and is intentionally unused.
export function resolveGreetingElementTh(
  _computeSource: ComputeMascotSource | null,
  personaElementTh: string | null | undefined,
): string | null {
  const persona = typeof personaElementTh === 'string' ? personaElementTh.trim() : ''
  return persona || null
}

// Map the raw ChineseHoroscopeGet response into the shape resolveMascotFromCompute reads.
// SHAPE (verified against my-destiny.tsx, a working consumer that reads `result.data.summary`/`.detail`):
// the /api/chinese-horoscope route returns `{ data: chart }`, but ChineseHoroscopeGet force-casts it to
// a FLAT RESPONSE type — so the `.data` envelope is invisible to tsc. Reading `chart.detail` directly
// therefore silently yielded `undefined` → element always null → the greeting ธาตุ row (mascot + text)
// never rendered on v2 home. UNWRAP `.data` first (fall back to the raw object if a caller ever passes
// it pre-unwrapped). The FIELDS were already correct: day-MASTER element = detail.dayAbove.element (日干),
// year animal = detail.yearBelow.constellation/id.
// PURE (no React) so it can be anchored without a DOM — see scripts/compute-source.test.ts.
export function toComputeSource(chart: unknown): ComputeMascotSource | null {
  const raw = chart as { data?: unknown } | null
  const c = (raw?.data ?? raw) as
    | { detail?: { yearBelow?: { constellation?: string; id?: number }; dayAbove?: { element?: string } } }
    | null
  const yb = c?.detail?.yearBelow
  const dayStemElement = c?.detail?.dayAbove?.element ?? null
  if (!yb) return null
  return {
    detail: { yearBelow: { constellation: yb.constellation ?? null, id: yb.id ?? null } },
    enrichment: { pillars: { day: { stemElement: dayStemElement } } },
  }
}
