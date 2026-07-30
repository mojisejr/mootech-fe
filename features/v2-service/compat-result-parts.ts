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

// The tone badge in Figma appears only on the extremes (A→"จุดแข็ง", D/F→"ต้องดูแล"); mid grades show none.
// ⚠️ CONTRACT NOTE: CompatDimension has NO `tone` field. This is a UI-DERIVED encoding of the grade the
// engine already returned — NOT fabricated data. If webgang wants tone to be authoritative (engine-decided),
// goo adds `tone: 'strong'|'watch'` to the contract and the card should prefer that over this derivation.
export type DimTone = 'strong' | 'watch' | null

export function deriveTone(grade?: string | null): DimTone {
  const tier = gradeTier(grade)
  if (tier === 'good') return 'strong'
  if (tier === 'poor') return 'watch'
  return null // fair / weak → no badge, matching the Figma
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
