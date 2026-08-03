// features/v2-service/compat-result-parts.ts — ดวงสมพงศ์ 2E-2 shared PURE helpers for the result parts.
// No React, no fetch. The grade→colour scale + tone derivation live here so the dimension card, the pillar
// table, and the (future) wiring all agree. Semantic colours are INLINE hex (a grade scale is semantic, not
// the accent) — kept out of Tailwind arbitrary-value classes on purpose (verify-architecture bans those).
//
// Grade scale RE-SAMPLED from Figma 636:19532 (Zone 2 · 2026-08-03): the node draws FIVE distinct steps, so
// A and B are no longer one bucket — A is a deeper green than B. ฟีม ruled plain "C" joins C- on orange.
//   A± → deep green · B± → green · C+ → yellow-lime · C / C- → orange · D± / F → deep red.

export type GradeTier = 'best' | 'good' | 'fair' | 'weak' | 'poor'

export function gradeTier(grade?: string | null): GradeTier {
  const g = (grade ?? '').trim().toUpperCase()
  if (!g) return 'weak'
  const letter = g.charAt(0)
  if (letter === 'A') return 'best'
  if (letter === 'B') return 'good'
  if (g === 'C+') return 'fair'
  if (letter === 'C') return 'weak' // C and C- (ฟีม 2026-08-03: plain C is orange)
  return 'poor' // D / E / F and below
}

// bar fill + grade-pill background per tier — every value sampled from the Figma node, not eyeballed.
export const TIER_COLOR: Record<GradeTier, string> = {
  best: '#2E7D32', // deep green (A)
  good: '#66BB6A', // green (B)
  fair: '#CDDC39', // yellow-lime (C+)
  weak: '#F57C00', // orange (C / C-)
  poor: '#B71C1C', // deep red (D / F)
}

// the tinted rationale box under each dimension row — the soft pair of TIER_COLOR (Figma-sampled).
export const TIER_SOFT: Record<GradeTier, string> = {
  best: '#E8F5E9',
  good: '#F0F8F0',
  fair: '#F9FBE7',
  weak: '#FFF0E1',
  poor: '#FCE4EC',
}

// text colour ON a grade pill: the yellow-lime C+ pill needs dark ink to stay readable (Figma uses #374151).
export const TIER_INK: Record<GradeTier, string> = {
  best: '#FFFFFF',
  good: '#FFFFFF',
  fair: '#374151',
  weak: '#FFFFFF',
  poor: '#FFFFFF',
}

// SIDE TINT — the self/other panel palette shared by ธาตุ&เสา (Zone 3) and รายคน (Zone 4), and the same
// #ECF0FC that backs the Zone 1 pill-tab container. One system, sampled once.
export const SIDE_TINT = { self: '#ECF0FC', other: '#F9F4F0' } as const
export type SideKey = keyof typeof SIDE_TINT

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

// ELEMENT CHIP PALETTE — one SYSTEM, not five hand-picked pairs.
//
// Figma 636:22150 renders only the 水/土 pair, so those two glyph colours are sampled straight from the node.
// Measuring them revealed the rule the tile follows:
//
//     tile bg  =  the glyph colour composited over WHITE at 16.2% opacity
//
// It holds on BOTH sampled elements across ALL SIX channels (น้ำ 0.162/0.165/0.160 · ดิน 0.157/0.165/0.162),
// and re-deriving from the rule reproduces the sampled bg EXACTLY (#E2ECFB, #F7EFE2). So the tile is not a
// free choice — only the glyph colour is. `elementTint()` below is that rule, and `run-compat-zones.ts`
// asserts every element obeys it (tooth: mut-element-tint-drift).
//
// ไม้ / ไฟ / ทอง have NO node in the Figma file to sample (searched: no design-system component, the chip is
// a plain frame not an instance, its fills bind no variable, and the "ธาตุของคุณ" screen 300-2356 uses a
// different small-icon treatment). ฟีม ruled 2026-08-03: take the hue family of the documented element
// palette but tune saturation/lightness to sit with the two real chips, and darken ไม้ a step —
// chosen from a rendered 5-step comparison, not by eye-balling a hex.
const TINT_ALPHA = 0.162

/** the tile background for a glyph colour — the glyph over white at TINT_ALPHA (the Figma-proven rule). */
export function elementTint(fg: string): string {
  const s = fg.replace('#', '')
  const ch = [0, 2, 4].map((i) => parseInt(s.slice(i, i + 2), 16))
  return '#' + ch.map((v) => Math.round(v * TINT_ALPHA + 255 * (1 - TINT_ALPHA)).toString(16).padStart(2, '0').toUpperCase()).join('')
}

export type WuXing = { hanzi: string; bg: string; fg: string }
const NEUTRAL: WuXing = { hanzi: '', bg: '#EEF1F4', fg: '#464646' }
// glyph colours: น้ำ/ดิน = Figma-sampled (636:22150) · ไม้/ไฟ/ทอง = ฟีม-ruled 2026-08-03. Tiles all derived.
const GLYPH: Record<string, { hanzi: string; fg: string }> = {
  'ไม้': { hanzi: '木', fg: '#4CBD32' },
  'ไฟ': { hanzi: '火', fg: '#D94C4C' },
  'ดิน': { hanzi: '土', fg: '#CC9E4C' }, // Figma-sampled
  'ทอง': { hanzi: '金', fg: '#D9B84C' },
  'โลหะ': { hanzi: '金', fg: '#D9B84C' },
  'น้ำ': { hanzi: '水', fg: '#4C8CE6' }, // Figma-sampled
}
const WUXING: Record<string, WuXing> = Object.fromEntries(
  Object.entries(GLYPH).map(([k, v]) => [k, { hanzi: v.hanzi, bg: elementTint(v.fg), fg: v.fg }]),
)
export function wuxing(elementTh?: string | null): WuXing {
  const k = (elementTh ?? '').trim()
  return WUXING[k] ?? NEUTRAL
}
