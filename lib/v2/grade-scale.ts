// lib/v2/grade-scale.ts — THE grade→colour scale. One place, both features.
//
// Created 2026-08-05 (มุน · M-C, lane carve-out from บอง) because two screens were about to hold the same
// scale twice: ดวงสมพงศ์ already had a 5-zone version sampled from Figma 636:19532, and ปฏิทิน was about to
// need one for the 13 wire levels. Duplicating five hexes across two features is the kind of thing that
// silently drifts the first time somebody edits one of them.
//
// ─────────────────────────────────────────────────────────────────────────────
// WHY FIVE ZONES AND NOT THIRTEEN COLOURS — measured, not chosen
// ─────────────────────────────────────────────────────────────────────────────
// The wire speaks 13 levels (lib/v2/api-grade.ts). The calendar used to paint 10 of them as 10 distinct
// colours. Measuring that ramp with ΔE2000 (JND ≈ 2.3; under ~10 means "you have to concentrate"):
//
//   adjacent pairs under ΔE 10 —  normal vision 3/9 · deuteranopia 6/9 · protanopia 5/9
//   worst pair: B- → C+ reads ΔE 2.9 to a protanope, i.e. the same colour
//
// The largest subset of that ramp where every adjacent pair clears ΔE 10 in ALL THREE vision types is
// FIVE. So the axis was already over-subscribed at 10, and 13 was never going to be readable.
//
// Independently, Figma had drawn exactly five steps for the compatibility result (636:19532) and ฟีม had
// already ruled on that scale ("plain C joins C- on orange"). Two different routes to the same number.
//
// THE PRECISION IS NOT LOST — IT MOVED. Every place a colour from this file is painted, the grade LETTER
// is printed next to it (GradeBadge, and CompatList/PredictionCards render through GradeBadge):
//
//   before — colour carries 10 levels, of which ~5 are actually distinguishable; the letter is decoration
//   after  — colour carries 5 zones, all 5 distinguishable; the letter carries all 13
//
// So the user ends up with MORE resolution than before (13 > 10), and for the first time the colour half
// of it is honest. This measures clean: 0/4 adjacent pairs under ΔE 10 in any vision type, and the worst
// pair among ALL pairs (the facet list shows four grades at once, not sorted) is best↔poor at ΔE 13.3.
//
// This matters more than it looks: real per-facet data shows two scale-adjacent grades sharing one card on
// 69–88% of days (มุน 13 days / บอง 8 cards), so an unreadable ramp would be on screen almost every day.
//
// ⚠️ NOT the calendar day-cell tint. The grid paints the TEN-STEP scale below (GRADE_STEP_COLOR — Figma
// 375:16710 draws every cell off the "Grade color / Grade color bg" variables, parity audit 2026-09-07),
// while the badge/ring/bar on the day page paint the 5 zones. The grid answers "which days this month are
// good" by comparison across 30 cells; this scale answers "how good is the selected day" as a single
// readout. They never paint the same day at once because the selected cell is overridden with the
// sapphire fill (MonthGrid).

/** The five zones. Ordered best → poor. */
export type GradeTier = 'best' | 'good' | 'fair' | 'weak' | 'poor'

/**
 * Wire grade → zone. Takes a plain string on purpose: the wire owns 13 levels (lib/v2/api-grade.ts) and
 * may gain more, and nothing here should turn red when it does — an unknown grade lands in `poor` rather
 * than crashing a screen. Covers all 13 today:
 *   poor  F · D- · D · D+      weak  C- · C      fair  C+      good  B- · B · B+      best  A- · A · A+
 */
export function gradeTier(grade?: string | null): GradeTier {
  const g = (grade ?? '').trim().toUpperCase()
  if (!g) return 'weak'
  const letter = g.charAt(0)
  if (letter === 'A') return 'best'
  if (letter === 'B') return 'good'
  if (g === 'C+') return 'fair'
  if (letter === 'C') return 'weak' // C and C- (ฟีม 2026-08-03: plain C is orange)
  return 'poor' // D± / E / F and anything unrecognised
}

/** bar fill + grade-pill background per zone — every value sampled from Figma 636:19532, not eyeballed. */
export const TIER_COLOR: Record<GradeTier, string> = {
  best: '#2E7D32', // deep green (A±)
  good: '#66BB6A', // green (B±)
  fair: '#CDDC39', // yellow-lime (C+)
  weak: '#F57C00', // orange (C · C-)
  poor: '#B71C1C', // deep red (D± · F)
}

/** the soft/tinted pair of TIER_COLOR — card grounds and rationale boxes (Figma-sampled). */
export const TIER_SOFT: Record<GradeTier, string> = {
  best: '#E8F5E9',
  good: '#F0F8F0',
  fair: '#F9FBE7',
  weak: '#FFF0E1',
  poor: '#FCE4EC',
}

/** ink ON a filled grade pill. The yellow-lime C+ pill needs dark ink to stay readable (Figma #374151). */
export const TIER_INK: Record<GradeTier, string> = {
  best: '#FFFFFF',
  good: '#FFFFFF',
  fair: '#374151',
  weak: '#FFFFFF',
  poor: '#FFFFFF',
}

// ─────────────────────────────────────────────────────────────────────────────
// THE TEN-STEP SCALE — Figma "Grade Card Previews" 636:21251 + month grid 375:16710
// ─────────────────────────────────────────────────────────────────────────────
// Figma names these as variables (`Grade color/70-79 B Good` = #66BB6A, `Grade color bg/70-79 B Good` =
// #F0F8F0, …) and paints every calendar day cell off them (parity audit docs/figma-parity-audit-2026-09-07.md,
// "สีช่องวัน 10 ขั้นตามเกรด"). The five zones above are a SUBSET of this table (A · B · C+ · C- · D-), so
// nothing on the day page moves; the month grid is the only consumer of the full ten.
//
// The ΔE argument at the top of this file still holds — neighbouring steps are close — which is why the
// grid keeps the grade letter OUT of the cell and prints the percent in the step's ink instead: the ink
// on a pale tint is what separates B- from C+ at a glance, not the tint alone.

/** The ten Figma steps, best → poor. The wire's A+/A-/F have no step of their own (see gradeStep). */
export type GradeStep = 'A' | 'B+' | 'B' | 'B-' | 'C+' | 'C' | 'C-' | 'D+' | 'D' | 'D-'

/** Ordered best → poor, for anything that has to walk the scale (tests, legends). */
export const GRADE_STEPS: readonly GradeStep[] = ['A', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D+', 'D', 'D-']

/**
 * Wire grade (13 levels, lib/v2/api-grade.ts) → Figma step (10). A+/A- fold into A, F into D-; an unknown
 * or empty grade lands on D- rather than throwing inside a render (same posture as gradeTier).
 */
export function gradeStep(grade?: string | null): GradeStep {
  const g = (grade ?? '').trim().toUpperCase()
  const letter = g.charAt(0)
  if (letter === 'A') return 'A'
  const sign = g.charAt(1) === '+' ? '+' : g.charAt(1) === '-' ? '-' : ''
  if (letter === 'B' || letter === 'C' || letter === 'D') return `${letter}${sign}` as GradeStep
  return 'D-' // F and anything unrecognised
}

/** cell tint (`Grade color bg/…`) + ink (`Grade color/…`) per step — copied from the Figma variables verbatim. */
export const GRADE_STEP_COLOR: Record<GradeStep, { bg: string; ink: string }> = {
  'A': { bg: '#E8F5E9', ink: '#2E7D32' }, // 90-100 A  Excellent
  'B+': { bg: '#EDF7ED', ink: '#43A047' }, // 80-89  B+ Very Good
  'B': { bg: '#F0F8F0', ink: '#66BB6A' }, // 70-79  B  Good
  'B-': { bg: '#F1F8E8', ink: '#8BC34A' }, // 60-69  B- Above Average
  'C+': { bg: '#F9FBE7', ink: '#CDDC39' }, // 50-59  C+ Average+
  'C': { bg: '#FFF3E0', ink: '#FFA726' }, // 45-49  C  Average
  'C-': { bg: '#FFF0E1', ink: '#F57C00' }, // 40-44  C- Below Average
  'D+': { bg: '#FBE9E7', ink: '#E64A19' }, // 35-39  D+ Poor
  'D': { bg: '#FFEBEE', ink: '#D32F2F' }, // 25-34  D  Very Poor
  'D-': { bg: '#FCE4EC', ink: '#B71C1C' }, // 0-24   D- Critical
}
