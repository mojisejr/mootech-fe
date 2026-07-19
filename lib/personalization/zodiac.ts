// Personalization — zodiac + element tables (DESIGN.md §7, decision C, locked 2026-07-19).
//
// The MuMate mascot is keyed off TWO axes from two different sources (hybrid = an asset always
// exists, 12 นักษัตร × 5 ธาตุ = 60):
//   นักษัตร = YEAR animal (ปีเกิด)        — from the year pillar's earthly branch (地支)
//   ธาตุ    = DAY-MASTER element (polarity stripped: ไม้หยิน → ไม้)
//
// IMPORTANT — what the backend ACTUALLY returns (verified in this repo, NOT the loose DESIGN prose):
//   /api/calculator/compute → data.yearOfZodiac is a PILLAR object
//     { above, below, aboveElement, belowElement } where `below` is the Chinese earthly-branch
//     GLYPH (e.g. "亥"), rendered as text in components/box-chinese-table.tsx — it is NOT a Thai
//     นักษัตร string like "ชวด".
//   The English animal + branch order live under data.detail.yearBelow:
//     { id: 12, chinese_symbol: "亥", constellation: "PIG", ... }   (constants/api/response-chinese-horoscope.ts)
//     — `constellation` is the English animal (RAT..PIG); `id` is the branch order 1..12 which
//     equals the mascot NN (子=1=ชวด=01 … 亥=12=กุน=12).
// So the resolver accepts the animal in any of these forms (Thai นักษัตร, English constellation,
// Chinese branch glyph, or the 1..12 branch id) and normalizes to the canonical Thai นักษัตร + NN.
//
// This module is PURE (no side effects) so it is trivially unit-testable — see
// scripts/personalization-mascot.test.ts.

import { ELEMENT_LABEL_TH, ELEMENT_LABEL_EN, type BaziElement } from '@/lib/calculator/elements'
import { thaiToBaziElement } from '@/lib/calculator/map-enrichment'

export type ZodiacOrder =
  | '01' | '02' | '03' | '04' | '05' | '06'
  | '07' | '08' | '09' | '10' | '11' | '12'

export type ZodiacEntry = {
  order: ZodiacOrder // NN used in the asset filename (01..12)
  th: string // นักษัตร Thai (ชวด..กุน) — matches the asset filename token
  en: string // primary English animal (constellation) the backend emits
  branch: string // Chinese earthly-branch glyph (地支) yearOfZodiac.below carries
  id: number // earthly-branch id 1..12 (== NN; == detail.yearBelow.id)
}

// Canonical order table. Row order IS the zodiac order (ชวด first). One source of truth; every
// lookup map below is derived from it so they can never drift apart.
export const ZODIAC_TABLE: readonly ZodiacEntry[] = [
  { order: '01', th: 'ชวด', en: 'RAT', branch: '子', id: 1 },
  { order: '02', th: 'ฉลู', en: 'OX', branch: '丑', id: 2 },
  { order: '03', th: 'ขาล', en: 'TIGER', branch: '寅', id: 3 },
  { order: '04', th: 'เถาะ', en: 'RABBIT', branch: '卯', id: 4 },
  { order: '05', th: 'มะโรง', en: 'DRAGON', branch: '辰', id: 5 },
  { order: '06', th: 'มะเส็ง', en: 'SNAKE', branch: '巳', id: 6 },
  { order: '07', th: 'มะเมีย', en: 'HORSE', branch: '午', id: 7 },
  { order: '08', th: 'มะแม', en: 'GOAT', branch: '未', id: 8 },
  { order: '09', th: 'วอก', en: 'MONKEY', branch: '申', id: 9 },
  { order: '10', th: 'ระกา', en: 'ROOSTER', branch: '酉', id: 10 },
  { order: '11', th: 'จอ', en: 'DOG', branch: '戌', id: 11 },
  { order: '12', th: 'กุน', en: 'PIG', branch: '亥', id: 12 },
] as const

// นักษัตร Thai -> "01".."12"
export const ZODIAC_ORDER: Readonly<Record<string, ZodiacOrder>> = Object.fromEntries(
  ZODIAC_TABLE.map((z) => [z.th, z.order]),
)

// English animal -> นักษัตร Thai. Includes common aliases the backend or callers might use, so a
// "MOUSE"/"COW"/"HARE"/"SHEEP"/"CHICKEN"/"BOAR" never falls through the crack.
const EN_ALIASES: Readonly<Record<string, string>> = {
  RAT: 'ชวด', MOUSE: 'ชวด',
  OX: 'ฉลู', COW: 'ฉลู', BUFFALO: 'ฉลู', BULL: 'ฉลู',
  TIGER: 'ขาล',
  RABBIT: 'เถาะ', HARE: 'เถาะ', CAT: 'เถาะ',
  DRAGON: 'มะโรง',
  SNAKE: 'มะเส็ง', SERPENT: 'มะเส็ง',
  HORSE: 'มะเมีย',
  GOAT: 'มะแม', SHEEP: 'มะแม', RAM: 'มะแม',
  MONKEY: 'วอก',
  ROOSTER: 'ระกา', CHICKEN: 'ระกา', COCK: 'ระกา',
  DOG: 'จอ',
  PIG: 'กุน', BOAR: 'กุน',
}

// Chinese earthly-branch glyph -> นักษัตร Thai (yearOfZodiac.below carries this glyph).
const BRANCH_TO_TH: Readonly<Record<string, string>> = Object.fromEntries(
  ZODIAC_TABLE.map((z) => [z.branch, z.th]),
)

// branch id 1..12 -> นักษัตร Thai (detail.yearBelow.id).
const ID_TO_TH: Readonly<Record<number, string>> = Object.fromEntries(
  ZODIAC_TABLE.map((z) => [z.id, z.th]),
)

const ALL_TH = new Set(ZODIAC_TABLE.map((z) => z.th))

// Normalize ANY known animal representation to the canonical นักษัตร Thai string, or null.
// Accepts: Thai นักษัตร ("ชวด"), English/alias ("PIG","MOUSE"), Chinese branch glyph ("亥"),
// or the 1..12 branch id (number or numeric string).
export function toNakkasat(input: string | number | null | undefined): string | null {
  if (input === null || input === undefined) return null

  if (typeof input === 'number') {
    return ID_TO_TH[input] ?? null
  }

  const raw = input.trim()
  if (raw === '') return null

  // already Thai นักษัตร
  if (ALL_TH.has(raw)) return raw
  // Chinese branch glyph
  if (BRANCH_TO_TH[raw]) return BRANCH_TO_TH[raw]
  // numeric string id ("12")
  if (/^\d+$/.test(raw)) return ID_TO_TH[Number(raw)] ?? null
  // English animal / alias (case-insensitive)
  const en = raw.toUpperCase()
  if (EN_ALIASES[en]) return EN_ALIASES[en]

  return null
}

export function zodiacOrder(nakkasat: string | null | undefined): ZodiacOrder | null {
  if (!nakkasat) return null
  return ZODIAC_ORDER[nakkasat.trim()] ?? null
}

// ---- element (day-master) normalization -------------------------------------------------------

// Polarity tokens to strip from a day-master element label ("ไม้หยิน" -> "ไม้"). Handles an
// optional separating space ("ไม้ หยิน") too.
const POLARITY_RE = /\s*(หยิน|หยาง)\s*$/

export type NormalizedElement = {
  en: BaziElement // 'WOOD'..'WATER'
  th: string // 'ไม้'..'น้ำ' (the asset filename token)
  labelTh: string // 'ธาตุไม้'  (display convenience)
  labelEn: string // 'Wood'     (display convenience)
}

// Normalize a day-master element to its polarity-stripped English key + Thai label, or null.
// Accepts: English BaziElement ("WOOD"/"metal"), plain Thai ("ไม้"), or Thai + polarity ("ไม้หยิน").
export function normalizeElement(input: string | null | undefined): NormalizedElement | null {
  if (input === null || input === undefined) return null
  const raw = input.trim()
  if (raw === '') return null

  // English BaziElement (any case)
  const up = raw.toUpperCase()
  if ((ELEMENT_LABEL_TH as Record<string, string>)[up]) {
    const en = up as BaziElement
    return { en, th: ELEMENT_LABEL_TH[en], labelTh: `ธาตุ${ELEMENT_LABEL_TH[en]}`, labelEn: ELEMENT_LABEL_EN[en] }
  }

  // Thai, with polarity stripped ("ไม้หยิน" -> "ไม้")
  const th = raw.replace(POLARITY_RE, '').trim()
  const en = thaiToBaziElement(th)
  if (en) {
    return { en, th: ELEMENT_LABEL_TH[en], labelTh: `ธาตุ${ELEMENT_LABEL_TH[en]}`, labelEn: ELEMENT_LABEL_EN[en] }
  }

  return null
}
