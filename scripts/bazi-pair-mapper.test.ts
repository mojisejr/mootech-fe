// Ported from mootech-be src/matching/bazi/bazi-pair.mapper.spec.ts (#357), vitest instead of jest.
//
// SCOPE: be's spec has 8 describes; 4 of them cover toRawInput / toBaziPairRequest / buildDesc /
// mapBaziPairToResult / mapBaziPairToComputeResult, which belong to the callerless `/api/bazi/pair`
// seam that #357 deliberately did not port (see lib/matching/bazi-pair.mapper.ts's scope note). What
// is here is every test of the 5 helpers the live pair-match path imports — unchanged assertions.
import { describe, expect, it } from 'vitest'
import {
  buildRating,
  normalizeDate,
  normalizeGender,
  normalizeTime,
  resolveRelationship,
} from '@/lib/matching/bazi-pair.mapper'

describe('resolveRelationship', () => {
  it('maps every matching_type to relationship + domain', () => {
    expect(resolveRelationship('LOVE')).toEqual({ relationship: 'love', domain: 'love' })
    expect(resolveRelationship('BOSS')).toEqual({ relationship: 'boss', domain: 'work' })
    expect(resolveRelationship('EMPLOYEE')).toEqual({ relationship: 'subordinate', domain: 'work' })
    expect(resolveRelationship('FRIEND')).toEqual({ relationship: 'partner', domain: 'work' })
  })
})

describe('normalizers', () => {
  it('normalizeGender', () => {
    expect(normalizeGender('MALE')).toBe('male')
    expect(normalizeGender('FEMALE')).toBe('female')
    expect(normalizeGender('female')).toBe('female')
    expect(normalizeGender(undefined)).toBe('male')
  })

  it('normalizeDate', () => {
    expect(normalizeDate('1990-01-15')).toBe('1990-01-15')
    expect(normalizeDate('1990-01-15T00:00:00.000Z')).toBe('1990-01-15')
    expect(normalizeDate('1990-01-15 08:30')).toBe('1990-01-15')
    expect(normalizeDate('15/01/1990')).toBe('')
    expect(normalizeDate('')).toBe('')
    expect(normalizeDate(undefined)).toBe('')
  })

  it('normalizeTime', () => {
    expect(normalizeTime('08:30')).toBe('08:30')
    expect(normalizeTime('8:30')).toBe('08:30')
    expect(normalizeTime('14:00:00')).toBe('14:00')
    expect(normalizeTime('25:00')).toBe('')
    expect(normalizeTime('')).toBe('')
    expect(normalizeTime(undefined)).toBe('')
  })
})

describe('buildRating', () => {
  it('maps percent to a 1-10 band and carries the prose note', () => {
    const r = buildRating(35, 'อบอุ่น', 'D+')
    expect(r.rating).toBe(4) // ceil(35/10)
    expect(r.note).toBe('อบอุ่น')
    expect(r.start_score).toBe(30)
    expect(r.end_score).toBe(40)
  })

  it('clamps and falls back note to grade', () => {
    expect(buildRating(0, '', 'F').rating).toBe(1)
    expect(buildRating(100, '', 'A').rating).toBe(10)
    expect(buildRating(50, '', 'C').note).toBe('C')
  })
})
