// Types for the bazi pair-match connector, ported verbatim in shape from
// mootech-be src/matching/bazi/bazi-pair-match.types.ts (#357).
//
// This IS the live seam: POST /api/bazi/pair-match. On be it is reached from exactly one place —
// chinese-horoscope.service.ts:1081 inside computeBaziPair.
//
// The connector's role is "ยกกล่องส่งต่อ": reshape the response into the legacy v1 result block the
// compatibility screens read, AND keep the WHOLE pair-match blob so the v2 result screen can read the
// rich fields. No astrology logic anywhere in this module.
import type { MatchingResultShape } from './bazi-pair.types'

// pair-match accepts the engine relationships + "family"; resolveRelationship only ever yields the
// first four, but the type mirrors the route's enum.
export type PairMatchRelationship = 'love' | 'partner' | 'boss' | 'subordinate' | 'family'

// One person as /api/bazi/pair-match expects. birthTime is OPTIONAL by design: omitting it lets the
// route apply its own noon default AND flag timeKnown=false, so the result screen can honestly show
// "—" for an unknown hour.
export interface BaziPairMatchPersonInput {
  birthDate: string // YYYY-MM-DD
  birthTime?: string // HH:MM — omit when unknown (route defaults noon + timeKnown=false)
  gender: 'male' | 'female' | 'unspecified'
  province?: string
  displayName?: string
}

export interface BaziPairMatchRequest {
  relationship: PairMatchRelationship
  personA: BaziPairMatchPersonInput
  personB: BaziPairMatchPersonInput
}

// --- Response slice we read to rebuild the v1 block (the WHOLE object is kept too). ---
export interface PairMatchOverall {
  percent?: number | null
  grade?: string | null
  gradeLabel?: string
  hearts?: number
  emoji?: string | null
  ratingText?: string
}

export interface PairMatchDimension {
  key?: string
  label?: string
  pairingLabel?: string
  percent?: number | null
  grade?: string
  ratingText?: string
  isMain?: boolean
  sising?: unknown
}

export interface PairMatchElementInteraction {
  aElementTh?: string
  bElementTh?: string
  summaryTh?: string
  aToB?: unknown
  bToA?: unknown
}

// Only the fields the mapper reads are typed; extra fields (relationshipLabel, fourPillars, persons,
// note, ...) ride along untyped and are preserved verbatim in `pairMatch` — nothing is compressed out.
export interface BaziPairMatchResponse {
  relationship?: string
  domain?: string
  persons?: { a?: unknown; b?: unknown }
  overall?: PairMatchOverall
  dimensions?: PairMatchDimension[]
  elementInteraction?: PairMatchElementInteraction
  [key: string]: unknown
}

// What the calculate route stores in log_matching.result: the legacy v1 block PLUS the whole raw blob.
export interface PairMatchComputeResult {
  me: unknown
  you: unknown
  result: MatchingResultShape
  pairMatch: BaziPairMatchResponse
}
