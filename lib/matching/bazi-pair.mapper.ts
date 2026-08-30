// PURE normalizers + the legacy rating band, ported from mootech-be
// src/matching/bazi/bazi-pair.mapper.ts (#357). No I/O — unit-tested DB-free.
//
// SCOPE NOTE (บอง, #357): be's file has 10 exports; 5 of them (toRawInput, toBaziPairRequest,
// buildDesc, mapBaziPairToResult, mapBaziPairToComputeResult) serve the `/api/bazi/pair` seam, which
// has no caller on be. Only the 5 helpers the LIVE pair-match path imports are ported —
// bazi-pair-match.mapper.ts:12-17 imports exactly: buildRating, normalizeDate, normalizeGender,
// normalizeTime, resolveRelationship. Their ported spec is scripts/bazi-pair-mapper.test.ts.
//
// Missing-time policy (operator decision 2026-07-01): bazi wants a birth time, the product treats it
// as optional. normalizeTime returns '' when unknown and the pair-match person builder OMITS the field,
// so the engine applies its own noon default and flags timeKnown=false. A missing DATE still refuses.
import type { BaziRelationship, MatchingRatingShape, MatchingType } from './bazi-pair.types'

// matching_type (FE/legacy) -> bazi relationship + scoring domain.
export function resolveRelationship(type: MatchingType): {
  relationship: BaziRelationship
  domain: 'love' | 'work'
} {
  switch (type) {
    case 'LOVE':
      return { relationship: 'love', domain: 'love' }
    case 'BOSS':
      return { relationship: 'boss', domain: 'work' }
    case 'EMPLOYEE':
      return { relationship: 'subordinate', domain: 'work' }
    case 'FRIEND':
      return { relationship: 'partner', domain: 'work' }
    default:
      return { relationship: 'love', domain: 'love' }
  }
}

export function normalizeGender(gender?: string): 'male' | 'female' {
  return String(gender ?? '')
    .trim()
    .toLowerCase()
    .startsWith('f')
    ? 'female'
    : 'male'
}

// Accepts ISO-ish dates ("1990-01-15", "1990-01-15T00:00:00Z"); returns "YYYY-MM-DD" or '' when it
// cannot be confidently parsed.
export function normalizeDate(dob?: string): string {
  const raw = String(dob ?? '').trim()
  if (!raw) {
    return ''
  }
  const head = raw.replace('T', ' ').split(' ')[0]
  return /^\d{4}-\d{2}-\d{2}$/.test(head) ? head : ''
}

// Accepts "HH:MM", "H:MM", "HH:MM:SS"; returns zero-padded "HH:MM" or '' when invalid.
export function normalizeTime(time?: string): string {
  const raw = String(time ?? '').trim()
  if (!raw) {
    return ''
  }
  const m = raw.match(/^(\d{1,2}):(\d{2})/)
  if (!m) {
    return ''
  }
  const hh = Number(m[1])
  const mm = Number(m[2])
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) {
    return ''
  }
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n))
}

// 0-100 percent -> legacy 1-10 rating band, carrying the bazi prose as the note.
export function buildRating(percent: number, note: string, grade: string): MatchingRatingShape {
  const score = clamp(Math.round(percent), 0, 100)
  const rating = clamp(Math.ceil(score / 10), 1, 10)
  const start_score = (rating - 1) * 10
  const end_score = rating * 10
  return {
    rating,
    note: note || grade || '',
    start_score,
    end_score,
  }
}
