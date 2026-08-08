// Personalization — mascot asset resolver (DESIGN.md §7, decision C).
//
// Pure, side-effect-free core so it unit-tests without a browser or backend. A thin React hook
// (use-mascot.ts) wraps resolveMascotFromCompute for screen use (result / home / profile).
//
// Filename convention (verified against `ls public/images/v2/characters` — 60 files, no misses):
//   `${order}_${นักษัตร}-${ธาตุ}`   e.g. "12_กุน-ไม้"
//   → character: /images/v2/characters/12_กุน-ไม้.webp  (transparent, no bg)
//   → card:      /images/v2/cards/12_กุน-ไม้.jpg         (with bg)

import {
  toNakkasat,
  zodiacOrder,
  normalizeElement,
  type ZodiacOrder,
  type NormalizedElement,
} from '@/lib/personalization/zodiac'

const CHARACTERS_DIR = '/images/v2/characters'
const CARDS_DIR = '/images/v2/cards'

export type MascotPaths = {
  /** transparent WEBP, no background — /images/v2/characters/NN_นักษัตร-ธาตุ.webp */
  character: string
  /** JPG with background artwork — /images/v2/cards/NN_นักษัตร-ธาตุ.jpg */
  card: string
}

export type MascotResult = MascotPaths & {
  order: ZodiacOrder // "01".."12"
  filename: string // "12_กุน-ไม้" (no extension)
  animalTh: string // "กุน"
  elementTh: string // "ไม้"
  elementEn: NormalizedElement['en'] // "WOOD"
  elementLabelTh: string // "ธาตุไม้"
  elementLabelEn: string // "Wood"
}

// Low-level PURE builder: canonical Thai นักษัตร + polarity-stripped Thai ธาตุ -> absolute paths.
// Returns null on any invalid/unknown input (never throws, never emits a broken path).
export function buildMascotPaths(nakkasatTh: string, elementTh: string): MascotResult | null {
  const order = zodiacOrder(nakkasatTh)
  if (!order) return null

  const el = normalizeElement(elementTh)
  if (!el) return null

  const filename = `${order}_${nakkasatTh}-${el.th}`
  return {
    order,
    filename,
    animalTh: nakkasatTh,
    elementTh: el.th,
    elementEn: el.en,
    elementLabelTh: el.labelTh,
    elementLabelEn: el.labelEn,
    character: `${CHARACTERS_DIR}/${filename}.webp`,
    card: `${CARDS_DIR}/${filename}.jpg`,
  }
}

// Resolver from the two raw axes, in whatever shape the source provides them:
//   yearAnimal        — Thai นักษัตร | English constellation | Chinese branch glyph | branch id 1..12
//   dayMasterElement  — English BaziElement | Thai ธาตุ | Thai ธาตุ+polarity ("ไม้หยิน")
export function resolveMascot(
  yearAnimal: string | number | null | undefined,
  dayMasterElement: string | null | undefined,
): MascotResult | null {
  const nakkasat = toNakkasat(yearAnimal)
  if (!nakkasat) return null
  const el = normalizeElement(dayMasterElement)
  if (!el) return null
  return buildMascotPaths(nakkasat, el.th)
}

// ---- resolve straight from the /api/calculator/compute payload --------------------------------

// The `data` object returned under { data: ... } by /api/calculator/compute. Only the fields the
// resolver reads are typed here; the endpoint returns more (summary/detail/cycleLife/…).
export type ComputeMascotSource = {
  // Year pillar — the earthly branch (地支) glyph lives at .below (e.g. "亥").
  yearOfZodiac?: { below?: string | null } | null
  // Richer year-branch detail: constellation = English animal ("PIG"), id = branch order 1..12.
  detail?: { yearBelow?: { constellation?: string | null; id?: number | null } | null } | null
  // Enrichment carries the day-master element (Thai label). pillars.day.stemElement is the fallback.
  enrichment?: {
    dayMasterElement?: string | null
    pillars?: { day?: { stemElement?: string | null } | null } | null
  } | null
}

// Pull the year animal from the compute payload, preferring the most explicit source:
//   1. detail.yearBelow.constellation  (English animal — cleanest)
//   2. detail.yearBelow.id             (branch order 1..12)
//   3. yearOfZodiac.below              (Chinese branch glyph)
export function animalFromCompute(data: ComputeMascotSource | null | undefined): string | null {
  if (!data) return null
  return (
    toNakkasat(data.detail?.yearBelow?.constellation) ??
    toNakkasat(data.detail?.yearBelow?.id) ??
    toNakkasat(data.yearOfZodiac?.below) ??
    null
  )
}

// Pull the day-master element, preferring the top-level enrichment field, then the day pillar.
export function elementFromCompute(data: ComputeMascotSource | null | undefined): string | null {
  if (!data) return null
  return data.enrichment?.dayMasterElement ?? data.enrichment?.pillars?.day?.stemElement ?? null
}

// One-call resolver for screens: compute payload -> mascot paths + labels, or null if either axis
// is missing (e.g. enrichment was best-effort and came back null — caller shows a static fallback).
export function resolveMascotFromCompute(data: ComputeMascotSource | null | undefined): MascotResult | null {
  return resolveMascot(animalFromCompute(data), elementFromCompute(data))
}
