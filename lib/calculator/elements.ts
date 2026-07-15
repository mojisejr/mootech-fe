// 5-element color system for the public calculator (#public-bazi-calculator). Colors are DATA,
// not decoration — every 天干/地支 the backend returns maps to one of these 5 elements.
// Locked palette — history preserved (Principle 1: nothing deleted, superseded with reason):
//   v1 (2026-07-15 goo+มุน): darkened all to >=4.5:1 on white + bg_gray; METAL was a cool slate
//     #556270 (金=metal/white traditionally) chosen because a gold METAL collided with EARTH #8B5F20
//     at ΔE 8.7 (indistinguishable — bad, since color IS data here).
//   v2 (2026-07-15 #calculator-reframe-v2, ฟีม froze): ฟีม asked METAL back to GOLD. To keep it
//     distinguishable from EARTH, the gold lives as a glyph tone #8A5E12 (white 5.69 / bg_gray 4.72)
//     AND EARTH shifts to a cooler OLIVE #5F5326 (white 7.63 / bg_gray 6.34) — opening EARTH↔METAL
//     back to ΔE 24.0. Full re-verify: every element >=4.5:1 on white+bg_gray, worst pairwise ΔE 24.
//     A brighter gold GRADIENT (ELEMENT_FILL_GRADIENT) is used only as a FILL (ดิถี circle) with a
//     dark glyph — a bright gold can't be a legible glyph-on-white, so it only appears as ground.
export type BaziElement = 'WOOD' | 'FIRE' | 'EARTH' | 'METAL' | 'WATER'

export const ELEMENT_COLOR: Record<BaziElement, string> = {
  WOOD: '#237753', // 4.55:1 bg_gray / 5.48:1 white
  FIRE: '#C4341F', // 4.52:1 bg_gray / 5.44:1 white
  EARTH: '#5F5326', // 6.34:1 bg_gray / 7.63:1 white — olive (v2, was #8B5F20 ochre)
  METAL: '#8A5E12', // 4.72:1 bg_gray / 5.69:1 white — gold (v2, was slate #556270); ΔE 24 from EARTH
  WATER: '#2C55A6', // 5.90:1 bg_gray / 7.10:1 white
}

// Bright gold gradient — FILL only (ดิถี circle when day-master = METAL). Never a glyph-on-white.
// Paired with a dark glyph (#101828): 5.45:1 on the dark end, 10.6:1 on the light end.
export const METAL_FILL_GRADIENT = 'linear-gradient(135deg, #B8860B 0%, #E8C468 100%)'

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

// ดิถี hero — the circle is FILLED with the element color so "you are a <element> person" reads
// instantly. METAL uses the bright gold gradient; the glyph color flips to stay legible on the
// fill (dark on the light gold, white on the deeper element colors — all verified >=4.5:1).
export function ditiFillBackground(element: string | undefined | null): string {
  return (element as BaziElement) === 'METAL' ? METAL_FILL_GRADIENT : elementColor(element)
}

export function ditiGlyphColor(element: string | undefined | null): string {
  return (element as BaziElement) === 'METAL' ? '#101828' : '#FFFFFF'
}
