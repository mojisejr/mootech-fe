// PURE mapping layer for the bazi pair-match connector, ported from mootech-be
// src/matching/bazi/bazi-pair-match.mapper.ts (#357). No I/O. No astrology logic — pure reshape.
//   1. Build the /api/bazi/pair-match request from the two-person matching input.
//   2. Reshape the response into (a) the legacy v1 result block the compatibility screens already read
//      (result.{score, rating.rating, rating.note, desc[].note}) and (b) the WHOLE raw blob preserved
//      for the v2 result screen.
import { buildRating, normalizeDate, normalizeGender, normalizeTime, resolveRelationship } from './bazi-pair.mapper'
import type { MatchingDescShape, MatchingPersonInput, MatchingResultShape, MatchingType } from './bazi-pair.types'
import type {
  BaziPairMatchPersonInput,
  BaziPairMatchRequest,
  BaziPairMatchResponse,
  PairMatchComputeResult,
} from './bazi-pair-match.types'

const DEFAULT_PROVINCE = 'กรุงเทพมหานคร'

// Build one person for /pair-match. A missing/invalid DATE returns null (caller refuses). birthTime is
// OMITTED when unknown — the route applies its own noon default AND sets timeKnown=false, so the score
// stays identical to the legacy noon-send path while the screen learns the hour was unknown.
export function toPairMatchPerson(person: MatchingPersonInput): BaziPairMatchPersonInput | null {
  const birthDate = normalizeDate(person?.dob)
  if (!birthDate) {
    return null
  }
  const birthTime = normalizeTime(person?.time) // '' when unknown/invalid
  const out: BaziPairMatchPersonInput = {
    birthDate,
    gender: normalizeGender(person?.gender),
    province: DEFAULT_PROVINCE,
  }
  if (birthTime) {
    out.birthTime = birthTime // present only when known → timeKnown=true at the route
  }
  const name = String(person?.name ?? '').trim()
  if (name) {
    out.displayName = name
  }
  return out
}

// Build the full pair-match request; null if either person is not usable.
export function toPairMatchRequest(
  me: MatchingPersonInput,
  you: MatchingPersonInput,
  type: MatchingType,
): BaziPairMatchRequest | null {
  const personA = toPairMatchPerson(me)
  const personB = toPairMatchPerson(you)
  if (!personA || !personB) {
    return null
  }
  return {
    relationship: resolveRelationship(type).relationship,
    personA,
    personB,
  }
}

// Compose the legacy Thai desc bullets: element summary first, then "<pairingLabel|label>: <ratingText>"
// per dimension, finally the overall prose as a fallback.
export function buildDescFromPairMatch(resp: BaziPairMatchResponse): MatchingDescShape[] {
  const desc: MatchingDescShape[] = []

  const summary = resp?.elementInteraction?.summaryTh
  if (typeof summary === 'string' && summary.trim()) {
    desc.push({ note: summary.trim() })
  }

  const dims = Array.isArray(resp?.dimensions) ? resp.dimensions : []
  for (const d of dims) {
    const text = typeof d?.ratingText === 'string' ? d.ratingText.trim() : ''
    if (!text) {
      continue
    }
    const label = (d?.pairingLabel || d?.label || '').trim()
    desc.push({ note: label ? `${label}: ${text}` : text })
  }

  if (desc.length === 0) {
    const main = resp?.overall?.ratingText
    if (typeof main === 'string' && main.trim()) {
      desc.push({ note: main.trim() })
    }
  }

  return desc
}

// Reshape a pair-match response into the legacy v1 result block. `domain` comes from the matching type
// (not resp.domain) to stay identical to be.
export function mapPairMatchToResult(resp: BaziPairMatchResponse, type: MatchingType): MatchingResultShape {
  const { relationship, domain } = resolveRelationship(type)

  const rawPercent = resp?.overall?.percent
  const percent = typeof rawPercent === 'number' ? rawPercent : 0
  const grade = (resp?.overall?.grade as string) || ''
  const note = (resp?.overall?.ratingText as string) || ''
  const score = Math.round(percent * 100) / 100

  return {
    result: {
      engine: 'bazi',
      relationship,
      domain,
      percent,
      grade: grade || null,
    },
    score,
    rating: buildRating(percent, note, grade),
    desc: buildDescFromPairMatch(resp),
  }
}

// Full compute result stored in log_matching.result: the v1 block PLUS the whole raw pair-match blob
// (ห้ามบีบทิ้ง). me/you carry the slim person profiles for traceability.
export function mapPairMatchToComputeResult(
  resp: BaziPairMatchResponse,
  type: MatchingType,
): PairMatchComputeResult {
  return {
    me: resp?.persons?.a ?? null,
    you: resp?.persons?.b ?? null,
    result: mapPairMatchToResult(resp, type),
    pairMatch: resp ?? {},
  }
}
