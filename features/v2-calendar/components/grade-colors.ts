// MuMate v2 — ปฏิทินดวง · the SHARED grade + day-cell color system (Lamun · DESIGN.md is the single source).
//
// goo's grade.ts owns the LOGIC (grade order, dayCellTier thresholds). This file owns the COLORS — one
// place, so the ring · badge · %-bar · calendar cell never hardcode a hex apart from here (frame done-condition
// 6: "ระบบเกรด = component ตัวเดียว ไม่มี hardcode สีกระจาย" — now 13 levels via 5 zones). Every value below is copied verbatim from
// mootech-fe/DESIGN.md — NOT eyeballed from Figma. If a needed color isn't here, add it to DESIGN.md first (ฟีม A3).
import { gradeTier, TIER_COLOR, TIER_SOFT, TIER_INK, GRADE_STEP_COLOR, GRADE_STEPS, type GradeStep } from '@/lib/v2/grade-scale'

/**
 * DESIGN.md §GRADE — the grade's card bg + accent + badge ink, for ANY of the 13 wire levels.
 *
 * REPLACED the 10-entry `Record<Grade, …>` ramp (มุน · M-C 2026-08-05). That ramp painted ten distinct
 * colours, but measured with ΔE2000 only about five of them were separable — 3/9 adjacent pairs sat under
 * ΔE 10 for normal vision, 6/9 under deuteranopia, and B-→C+ read ΔE 2.9 to a protanope, which is the
 * same colour. Adding A+/A-/F to it would have made a legible-looking scale that is not legible.
 *
 * So the colour now speaks FIVE zones (lib/v2/grade-scale.ts, shared with ดวงสมพงศ์, sampled from Figma
 * 636:19532) and the grade LETTER carries all 13 levels — and the letter is always printed right there by
 * GradeBadge. Net: the user gets 13 levels of resolution instead of 10, and the colour half stops lying.
 *
 * Takes a plain grade string because the wire owns the level list (lib/v2/api-grade.ts); an unknown grade
 * degrades to the `poor` zone rather than throwing inside a render.
 */
export function gradeColors(grade?: string | null): { bg: string; accent: string; badgeText: string } {
  const tier = gradeTier(grade)
  return { bg: TIER_SOFT[tier], accent: TIER_COLOR[tier], badgeText: TIER_INK[tier] }
}

/**
 * Calendar day-cell — cell tint + %-text per GRADE STEP (Figma month grid 375:16710 paints every cell off the
 * ten `Grade color bg/…` / `Grade color/…` variables; parity audit 2026-09-07 "สีช่องวัน 10 ขั้นตามเกรด").
 * Replaced the 3-tier percent ramp (#E2F4F6/#FEF1E0/#FEE7E4), which was never in the node. The step comes
 * from the cell's `grade` (gradeStep), not from the percent — the percent→grade mapping is bazi's.
 */
export const DAY_CELL_COLORS: Record<GradeStep, { tint: string; text: string }> = Object.fromEntries(
  GRADE_STEPS.map((s) => [s, { tint: GRADE_STEP_COLOR[s].bg, text: GRADE_STEP_COLOR[s].ink }]),
) as Record<GradeStep, { tint: string; text: string }>

/** Calendar markers (DESIGN.md): selected-day / วันพระ ring — #9D85DA (≠ Accent/Purple #AF9CE0). */
export const CALENDAR_MARKER = '#9D85DA'
/** Selected-day fill (Figma month cell 14 = sapphire fill + white text). */
export const SELECTED = { fill: '#1455A4', text: '#FFFFFF' }
