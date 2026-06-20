// Bazi→mootech mapping primitives (Phase 3.1, #mootech-fullstack-supabase-fold).
// PURE, unit-tested. These are the CONFIRMED join-key transforms used by the chart adapter (B1)
// and reference-table joins (B3). Confirmed against a real log_calculate golden fixture:
//   summary.day.element = "METAL", analytic.base.element = "WOOD", analytic.habit.level = "BALANCE".
// → mootech stores elements as English UPPERCASE; bazi emits lowercase (wood/fire/earth/metal/water).
//
// NOT included here (deferred to the chart phase, needs multi-fixture verification — do not guess):
//   - per-pillar `element` = 納音 (nayin) of the stem-branch pair (e.g. 甲午→METAL), which is NOT the
//     stem's own element. Requires a verified 60-jiazi→element table; build it against fixtures.

export type BaziElement = 'wood' | 'fire' | 'earth' | 'metal' | 'water'
export type MootechElement = 'WOOD' | 'FIRE' | 'EARTH' | 'METAL' | 'WATER'

const ELEMENT_UP: Record<BaziElement, MootechElement> = {
  wood: 'WOOD',
  fire: 'FIRE',
  earth: 'EARTH',
  metal: 'METAL',
  water: 'WATER',
}

// bazi element (any case) -> mootech UPPERCASE element (the analytic_*/color/scared_thing join key).
export function toMootechElement(baziElement: string): MootechElement {
  const key = String(baziElement ?? '').trim().toLowerCase() as BaziElement
  const up = ELEMENT_UP[key]
  if (!up) throw new Error(`Unknown bazi element: ${JSON.stringify(baziElement)}`)
  return up
}

// bazi ElementStrengthValue.strength / dayMasterStrengthProfile -> mootech `level` key.
// Confirmed: 'balanced' -> 'BALANCE'. 'strong'/'weak' map to STRONG/WEAK. 'missing' has no observed
// fixture yet -> treated as WEAK (flagged) until a fixture confirms.
const LEVEL: Record<string, string> = {
  strong: 'STRONG',
  balanced: 'BALANCE',
  weak: 'WEAK',
  missing: 'WEAK', // TODO: confirm vs a missing-element fixture
}

export function toMootechLevel(strength: string): string {
  const key = String(strength ?? '').trim().toLowerCase()
  return LEVEL[key] ?? key.toUpperCase()
}

// Day-master stem polarity -> mootech summary.power ('YANG' | 'YIN').
// Heaven stems: 甲丙戊庚壬 = YANG, 乙丁己辛癸 = YIN (also accept romanized jia/bing/... and odd/even index).
const YANG_STEMS = new Set(['甲', '丙', '戊', '庚', '壬', 'jia', 'bing', 'wu', 'geng', 'ren'])
const YIN_STEMS = new Set(['乙', '丁', '己', '辛', '癸', 'yi', 'ding', 'ji', 'xin', 'gui'])

export function stemPolarity(stem: string): 'YANG' | 'YIN' {
  const s = String(stem ?? '').trim().toLowerCase()
  const raw = String(stem ?? '').trim()
  if (YANG_STEMS.has(raw) || YANG_STEMS.has(s)) return 'YANG'
  if (YIN_STEMS.has(raw) || YIN_STEMS.has(s)) return 'YIN'
  throw new Error(`Unknown heaven stem: ${JSON.stringify(stem)}`)
}

// hiddenStems[] -> belowHiddenZodiac string (space-joined, matching fixture "丁 己").
export function hiddenZodiac(hiddenStems: string[] | null | undefined): string {
  return Array.isArray(hiddenStems) ? hiddenStems.join(' ') : ''
}
