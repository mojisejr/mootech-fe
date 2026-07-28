// MuMate v2 — ปฏิทินดวง · grade + day-cell logic (PURE, DB-free, unit-testable).
//
// What lives here is the LOGIC the design tokens can't hold: the 10-step grade ORDER and the day-cell
// TIER thresholds. The colors themselves stay in DESIGN.md / Lamun's component — this file only decides
// "which tier" / "which grade rank", never a hex.
import type { Grade, DayCellTier } from './types'

/** The 10 grades, best→worst (DESIGN.md §GRADE order). Ground-truth vocabulary — do not reorder. */
export const GRADES: readonly Grade[] = ['A', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D+', 'D', 'D-'] as const

/** Rank 0 (A, best) … 9 (D-, worst). Handy for sorting / comparing without a color. */
export function gradeRank(g: Grade): number {
  return GRADES.indexOf(g)
}

// Day-cell tier thresholds — AUTHORITATIVE from DESIGN.md §CALENDAR day-cell (Good ≥60 · Medium 40–59 ·
// Bad <40). The tint/%-text hexes for each tier are Lamun's (DESIGN.md); this only maps percent→tier.
export function dayCellTier(percent: number): DayCellTier {
  if (percent >= 60) return 'good'
  if (percent >= 40) return 'medium'
  return 'bad'
}

// NOTE — deliberately NO `gradeForPercent(percent): Grade` here.
// The grade↔percent mapping is bazi's ground-truth (see features/home/hooks/useHomeFortune.ts: "grade =
// gradeForPercent from bazi, single-sourced"). Inventing buckets in the FE would fork that contract and
// silently disagree with the backend at API-time. So every CalendarDay/DayDetail fixture carries its
// `grade` EXPLICITLY; at API-time the adapter fills `grade` straight from the bazi payload.
