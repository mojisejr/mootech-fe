// features/v2-service/compat-result-parts.ts — ดวงสมพงศ์ 2E-2 shared PURE helpers for the result parts.
// No React, no fetch. The grade→colour scale + tone derivation live here so the dimension card, the pillar
// table, and the (future) wiring all agree. Semantic colours are INLINE hex (a grade scale is semantic, not
// the accent) — kept out of Tailwind arbitrary-value classes on purpose (verify-architecture bans those).
//
// Grade scale read from Figma 636:18819 (รายมิติ cards): A/B → green · C+ → lime · C/C- → orange · D/F → red.

export type GradeTier = 'good' | 'fair' | 'weak' | 'poor'

export function gradeTier(grade?: string | null): GradeTier {
  const g = (grade ?? '').trim().toUpperCase()
  if (!g) return 'weak'
  const letter = g.charAt(0)
  if (letter === 'A' || letter === 'B') return 'good'
  if (g === 'C+') return 'fair'
  if (letter === 'C') return 'weak'
  return 'poor' // D / E / F and below
}

// bar fill + grade-pill background per tier (Figma-matched semantic scale)
export const TIER_COLOR: Record<GradeTier, string> = {
  good: '#34A853', // green
  fair: '#9CCC3B', // lime-green
  weak: '#F2994A', // orange
  poor: '#C0392B', // deep red (the D- pill)
}

// ⚠️ CONTRACT NOTE: CompatDimension has NO `tone` field (confirmed by บอง against the engine — manvsday.ts
// computes the star/warn at display time too, nothing is stored). This is a UI encoding of the grade the
// engine already returned — NOT fabricated data.
// THRESHOLD (ฟีม-ruled 2026-07-31, customer-facing wording for a relationship): "จุดแข็ง" = ALL A (A+/A/A-)
// PLUS B+ only; "ต้องดูแล" = ALL D (D+/D/D-) PLUS F; everything else — all C AND B AND B- — shows NO badge.
// Reason: B- ≈ 55%, and calling that a "strength" for a love reading overclaims. NOTE this makes B+ ≠ B, so
// tone is NOT uniform within the B letter (it IS within A, C, D) — the test encodes that split explicitly.
// Keyed off the grade DIRECTLY (not gradeTier): B/B- are green-tier for the BAR but earn no badge.
export type DimTone = 'strong' | 'watch' | null

export function deriveTone(grade?: string | null): DimTone {
  const g = (grade ?? '').trim().toUpperCase()
  if (!g) return null
  const letter = g.charAt(0)
  if (letter === 'A' || g === 'B+') return 'strong' // all A + B+ only
  if (letter === 'D' || g === 'F') return 'watch' // all D + F
  return null // C+, C, C-, B, B- → no badge
}

export const TONE_TEXT: Record<'strong' | 'watch', string> = {
  strong: '⭐ จุดแข็ง',
  watch: '⚠️ ต้องดูแล',
}

// clamp a percent to [0,100] for a bar width; undefined/null → 0 (the caller hides the row if there's no data)
export function pctWidth(percent?: number | null): number {
  if (percent == null || Number.isNaN(percent)) return 0
  return Math.max(0, Math.min(100, percent))
}

// WuXing (ธาตุทั้งห้า) — canonical hanzi + colours for the element interaction chips (Figma shows 水/土 etc).
// The contract only carries the Thai element name (elementTh), so this is a fixed TRANSLATION (น้ำ↔水 is a
// fact, not fabricated data). An unrecognised string → { hanzi: '', ... neutral } → the card shows the Thai
// text alone (never a wrong char). Keys cover the common Thai spellings the engine emits.
// 3C hero highlights (gap #2) — the blue-frame summary shows the strongest + weakest dimension with its %.
// DERIVED from the dimensions the engine already returned (best = max %, worst = min %), not a new field and
// not fabricated: it just re-surfaces existing numbers. The Figma's lead sentence ("คู่นี้ไม่ได้ราบรื่น…") has
// NO contract source, so it is OMITTED (rule 4) — flagged for ฟีม/goo. No dimensions → {} → the summary hides.
import type { CompatDimension } from './compatibility-result'
export type DimHighlight = { label: string; percent: number }
export function deriveHeroHighlights(dims?: CompatDimension[]): { best?: DimHighlight; worst?: DimHighlight } {
  const usable: DimHighlight[] = (dims ?? [])
    .filter((d) => d.percent != null && (d.label || d.pairingLabel))
    .map((d) => ({ label: (d.label ?? d.pairingLabel ?? '').trim(), percent: d.percent as number }))
  if (usable.length === 0) return {}
  const best = usable.reduce((a, b) => (b.percent > a.percent ? b : a))
  const worst = usable.reduce((a, b) => (b.percent < a.percent ? b : a))
  return { best, worst: worst.label === best.label ? undefined : worst } // single dim → no distinct "worst"
}

export type WuXing = { hanzi: string; bg: string; fg: string }
const NEUTRAL: WuXing = { hanzi: '', bg: '#EEF1F4', fg: '#464646' }
const WUXING: Record<string, WuXing> = {
  'ไม้': { hanzi: '木', bg: '#E4F4E4', fg: '#2E7D32' },
  'ไฟ': { hanzi: '火', bg: '#FDE4E1', fg: '#C0392B' },
  'ดิน': { hanzi: '土', bg: '#F6ECD6', fg: '#A9772B' },
  'ทอง': { hanzi: '金', bg: '#F3F0E4', fg: '#9A8A55' },
  'โลหะ': { hanzi: '金', bg: '#F3F0E4', fg: '#9A8A55' },
  'น้ำ': { hanzi: '水', bg: '#E1EEFA', fg: '#1B6EC2' },
}
export function wuxing(elementTh?: string | null): WuXing {
  const k = (elementTh ?? '').trim()
  return WUXING[k] ?? NEUTRAL
}
