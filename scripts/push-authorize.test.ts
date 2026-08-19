// #288 phase 4 — the cron secret gate, FAIL-CLOSED (goo). The production URL is public the moment it
// deploys, so a mutant that turns the gate off (or that treats an absent secret as "allow") must fail
// a specific line here. Truly-absent env is `undefined`, not '' — both tested (fail-closed needs a
// truly-absent probe, not a falsy proxy).
import { describe, it, expect } from 'vitest'
import { isAuthorized } from '@/lib/push/authorize'

const SECRET = 's3cr3t-random-32-bytes'

describe('isAuthorized · fail-closed cron gate', () => {
  it('correct "Bearer <secret>" → true', () => {
    expect(isAuthorized(`Bearer ${SECRET}`, SECRET)).toBe(true)
  })
  it('wrong secret → false', () => {
    expect(isAuthorized('Bearer nope', SECRET)).toBe(false)
  })
  it('missing Authorization header → false', () => {
    expect(isAuthorized(undefined, SECRET)).toBe(false)
  })
  it('raw secret without the Bearer prefix → false (Vercel always sends the prefix)', () => {
    expect(isAuthorized(SECRET, SECRET)).toBe(false)
  })
  it('FAIL-CLOSED: CRON_SECRET truly absent (undefined) → deny whatever the caller sends', () => {
    expect(isAuthorized('Bearer undefined', undefined)).toBe(false)
    expect(isAuthorized(undefined, undefined)).toBe(false)
  })
  it('FAIL-CLOSED: CRON_SECRET set to empty string → still deny (empty = not configured)', () => {
    expect(isAuthorized('Bearer ', '')).toBe(false)
  })
})
