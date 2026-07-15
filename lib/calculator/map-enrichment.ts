// Bridges bazi-sft-dataset's /api/bazi/public-calc response (#calculator-enrichment-FROZEN-v1)
// into this app's existing DecadeLuckItem/AnnualLuckItem shapes from map-timeline.ts. Two real
// mismatches to reconcile, both verified live (not assumed) against matching birth data:
//   1. Element labels come back as Thai strings ('ทอง') to match bazi-sft-dataset's own
//      ELEMENT_LABELS_TH — but this app's elementColor()/elementLabel() key off the English
//      BaziElement enum ('METAL'). Reverse-mapped below.
//   2. decades[] (from mapDecadeLuck, mootech-be) and enrichment.daYun (bazi-sft-dataset) are two
//      independently-computed arrays that happen to agree exactly on age numbers (verified live,
//      1990-05-15/08:30/male: both sources produced identical stem/element/ageStart for every
//      entry) — but decades[]'s own reversal logic (see getDisplayResultCycle) means its array
//      order is NOT guaranteed to line up by index with enrichment.daYun's chronological order.
//      Matched by ageStart value instead of index, which is safe regardless of either array's
//      internal ordering.
import { ELEMENT_LABEL_TH, type BaziElement } from '@/lib/calculator/elements'
import type { DecadeLuckItem, AnnualLuckItem } from '@/lib/calculator/map-timeline'
import type { DaYunRow, LiuNianRow } from '@/pages/api/calculator/compute'

const TH_TO_ELEMENT: Record<string, BaziElement> = Object.fromEntries(
  Object.entries(ELEMENT_LABEL_TH).map(([en, th]) => [th, en as BaziElement]),
)

export function thaiToBaziElement(thaiLabel: string): BaziElement | undefined {
  return TH_TO_ELEMENT[thaiLabel]
}

function parseAgeStart(ageRange: string): number {
  const m = ageRange.match(/^(\d+)-/)
  return m ? Number(m[1]) : -1
}

export type DecadePhasePair = { upper?: DaYunRow; lower?: DaYunRow }

// Finds the {upper 5yr, lower 5yr} enrichment rows whose combined span matches a decade block —
// upper/lower are always adjacent in daYun (see bazi-sft-dataset's buildDaYunPhaseInfos, which
// pushes upperPhase then lowerPhase per pillar in chronological order), so once the upper row is
// located by ageStart, the lower row is simply the next one.
export function findDecadePhasePair(daYun: DaYunRow[], decade: DecadeLuckItem): DecadePhasePair {
  const idx = daYun.findIndex((r) => parseAgeStart(r.ageRange) === decade.ageStart)
  if (idx === -1) return {}
  return { upper: daYun[idx], lower: daYun[idx + 1] }
}

// annual.year (from mootech-be's cycleYearLife) is NOT a calendar year — verified live it's a
// 1-indexed "Nth year of life" counter (year:1 = birth year itself: dob 1990-05-15 → year:1 gave
// 庚午, which matches bazi-sft-dataset's own annualGanzhi(1990) formula exactly). enrichment
// liuNian.year IS a real calendar year, but liuNian.age uses the same "birth year = age 1"
// counting (verified: dob 1990, calendar 2025 → age 36 = 2025-1990+1) — so the matching key is
// annual.year === liuNian.age, NOT annual.year === liuNian.year (which would never match, since
// one side is 1-100 and the other is a real 2025+ calendar year).
export function findLiuNianForYear(liuNian: LiuNianRow[], annual: AnnualLuckItem): LiuNianRow | undefined {
  return liuNian.find((y) => y.age === annual.year)
}
