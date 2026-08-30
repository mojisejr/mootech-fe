// Shared matching contract types, ported from mootech-be src/matching/bazi/bazi-pair.types.ts (#357).
//
// SCOPE NOTE (บอง, #357): be's copy of this file also models the `/api/bazi/pair` request/response
// (BaziRawInput / BaziPairRequest / BaziPairResponse / BaziComparison / BaziFacet / MatchingComputeResult).
// That seam is DEAD on be — `git grep "fetchBaziPair\b" -- src` in mootech-be returns only the definition
// at bazi-pair.adapter.ts:31, no caller. The live seam is `/api/bazi/pair-match`. So those types are NOT
// ported here; carrying them across would put a second, callerless engine path into FE. What stays is the
// part the live path actually uses: the matching vocabulary + the legacy v1 result contract the screens read.

// matching_type as the v1 API vocabulary spells it (features/v2-service/compatibility.ts:18).
export type MatchingType = 'LOVE' | 'BOSS' | 'EMPLOYEE' | 'FRIEND'

export type BaziRelationship = 'love' | 'partner' | 'boss' | 'subordinate'

// --- The legacy mootech matching contract the FE already renders ---
// The screens consume result.{score, rating.rating, rating.note, desc[].note}; the rest is
// preserved for parity/traceability.
export interface MatchingRatingShape {
  rating: number // 1-10
  note: string
  start_score: number
  end_score: number
}

export interface MatchingDescShape {
  note: string
}

export interface MatchingResultShape {
  result: Record<string, unknown>
  score: number
  rating: MatchingRatingShape
  desc: MatchingDescShape[]
}

// The per-person input the matching path resolves (be: CompatibilityLoveAnalyticInput.me/you).
export interface MatchingPersonInput {
  name?: string
  gender?: string
  dob?: string
  time?: string
}
