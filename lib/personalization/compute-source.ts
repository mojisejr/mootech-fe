import { resolveMascotFromCompute, type ComputeMascotSource } from '@/lib/personalization/mascot'

// The greeting ธาตุ element string. Prefer the compute/mascot element (matches the character shown),
// else fall back to bazi's persona element. CRITICAL: the persona path (/api/user → home-fortune BFF →
// bazi) is INDEPENDENT of the compute path (ChineseHoroscopeGet → NEXT_PUBLIC_BACKEND_URL), so this
// fallback renders the row even when the compute chain is FULLY null (e.g. a misconfigured backend
// URL), not merely when the `.data` envelope was undefined. null only when NEITHER source has it.
export function resolveGreetingElementTh(
  computeSource: ComputeMascotSource | null,
  personaElementTh: string | null | undefined,
): string | null {
  return resolveMascotFromCompute(computeSource)?.elementTh ?? personaElementTh ?? null
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
