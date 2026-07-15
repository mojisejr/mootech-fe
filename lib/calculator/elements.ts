// 5-element color system for the public calculator (#public-bazi-calculator). Colors are DATA,
// not decoration — every 天干/地支 the backend returns maps to one of these 5 elements.
// Locked palette (final, 2026-07-15, goo+มุน 2-round verify):
//   round 1: มุน's original tokens only passed 4.5:1 on bg_gray for WATER — darkened the other 4
//   (same hue/saturation, lightness only) until each hit >=4.5:1 on white + bg_gray (#E9EAEB).
//   round 2: มุน caught EARTH vs METAL colliding at ΔE 8.7 (near-indistinguishable at a glance,
//   which matters here because color IS data) — METAL replaced with a cool metallic-slate
//   (金 = metal/white traditionally, not gold — มุน's own correction), ΔE >=40 from every other
//   element now, contrast 5.18/6.24.
export type BaziElement = 'WOOD' | 'FIRE' | 'EARTH' | 'METAL' | 'WATER'

export const ELEMENT_COLOR: Record<BaziElement, string> = {
  WOOD: '#237753', // 4.55:1 bg_gray / 5.48:1 white
  FIRE: '#C4341F', // 4.52:1 bg_gray / 5.44:1 white
  EARTH: '#8B5F20', // 4.64:1 bg_gray / 5.59:1 white
  METAL: '#556270', // 5.18:1 bg_gray / 6.24:1 white — cool slate, ΔE>=40 from all others
  WATER: '#2C55A6', // 5.90:1 bg_gray / 7.10:1 white
}

export const ELEMENT_LABEL_TH: Record<BaziElement, string> = {
  WOOD: 'ไม้',
  FIRE: 'ไฟ',
  EARTH: 'ดิน',
  METAL: 'ทอง',
  WATER: 'น้ำ',
}

export const ELEMENT_LABEL_EN: Record<BaziElement, string> = {
  WOOD: 'Wood',
  FIRE: 'Fire',
  EARTH: 'Earth',
  METAL: 'Metal',
  WATER: 'Water',
}

export function elementColor(element: string | undefined | null): string {
  return ELEMENT_COLOR[(element as BaziElement) ?? ''] ?? '#6B7280'
}

export function elementLabel(element: string | undefined | null): string {
  const el = element as BaziElement
  if (!el || !ELEMENT_LABEL_TH[el]) return ''
  return `ธาตุ${ELEMENT_LABEL_TH[el]} · ${ELEMENT_LABEL_EN[el]}`
}
