// #585 — the ONE place that decides where a history card navigates.
//
// 🔴 WHY THIS DESERVES ITS OWN SPEC. Before #585 the destination was a hard-coded template inside the
// screen (`CompatibilityRecentScreen.tsx:81`). The moment a second lane existed, that template became a
// silent 404 generator for every colleague card: the pair reader is driven by `log_matching`
// (`pages/api/v2/matching/[id].ts:50,54`) and this lane writes no row there on purpose. A 404 after the
// user has already spent a quota unit is the expensive failure, and it looks like nothing at all in the
// list itself — the card renders perfectly.
//
// MUTANT CONTRACT
//   H1  always return the pair route            → ② reddens
//   H2  treat a missing lane as 'work'          → ③ reddens  (every pre-#585 row would dead-end)
//   H3  drop encodeURIComponent                 → ④ reddens
import { describe, it, expect } from 'vitest'
import { recentHrefFor } from '@/features/v2-service/compatibility-recent'

describe('#585 recentHrefFor — one lane, one route', () => {
  it('① a work card opens the colleague route', () => {
    expect(recentHrefFor({ id: 'abc', lane: 'work' })).toBe('/v2/service/compatibility/work/abc')
  })

  it('② a pair card opens the pair route — and the two are NOT the same string', () => {
    const pair = recentHrefFor({ id: 'abc', lane: 'pair' })
    expect(pair).toBe('/v2/service/compatibility/result/abc')
    expect(pair).not.toBe(recentHrefFor({ id: 'abc', lane: 'work' }))
  })

  it('③ a row with no lane is a pair row — every card written before #585 has no lane', () => {
    expect(recentHrefFor({ id: 'abc' })).toBe('/v2/service/compatibility/result/abc')
    // and anything unrecognised must not silently become 'work'
    expect(recentHrefFor({ id: 'abc', lane: 'nonsense' as never })).toBe('/v2/service/compatibility/result/abc')
  })

  it('④ the id is encoded — an id with a slash must not invent a path segment', () => {
    expect(recentHrefFor({ id: 'a/b', lane: 'work' })).toBe('/v2/service/compatibility/work/a%2Fb')
  })
})
