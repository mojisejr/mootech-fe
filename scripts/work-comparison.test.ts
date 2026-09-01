// scripts/work-comparison.test.ts — teeth for the colleague lane's read model (mootech-fe#585).
//
// The three DoD lines this file owns:
//   "หน้า Result แสดงอันดับจาก comparison.ranking ❌ ไม่ใช่เรียงเอง"
//   "แต่ละคนแสดงครบ 3 บทบาท"
//   "เบราว์เซอร์ไม่เคยได้รับก้อน 7MB"
//
// 🔴 The ranking test is written so that SORTING BY SCORE IS RED. A fixture whose ranking happens to agree
// with descending rankScore would pass under either implementation, which is the shape that lets a wrong
// one ship. Here ranking says [1,2,0] while the scores descend 0,1,2 — the two orders disagree on every
// seat, so "re-sorted it myself" cannot survive.
import { describe, it, expect } from 'vitest'
import { trimWorkResponse, readRankedCandidates, readRoles, WORK_ROLE_COUNT } from '@/features/v2-service/work-comparison'

const role = (perspective: string) => ({ perspective, stageName: 'เจ๊าะ', narrative: 'ยาว ๆ' })
const THREE_ROLES = [role('ตัวเรา → เจ้านาย'), role('ลูกน้อง → ตัวเรา'), role('หุ้นส่วน/เพื่อนร่วมงาน')]

function body(over: Record<string, unknown> = {}) {
  return {
    // the two blobs that make the real answer ~7MB — they must not survive the trim
    self: { huge: 'x'.repeat(1000) },
    candidates: [{ huge: 'y'.repeat(1000) }],
    comparison: {
      self: { elementTh: 'ดิน' },
      ranking: [1, 2, 0],
      candidates: [
        { index: 0, match: { forward: { percent: 90, grade: 'A', ratingText: 'ดีมาก', emoji: '🔥' } }, roles: THREE_ROLES },
        { index: 1, match: { forward: { percent: 60, grade: 'B' } }, roles: THREE_ROLES },
        { index: 2, match: { forward: { percent: 30, grade: 'C' } }, roles: THREE_ROLES },
      ],
      ...over,
    },
  }
}

describe('① trim — the browser never gets the 7MB body', () => {
  it('keeps comparison and drops the top-level self/candidates blobs', () => {
    const t = trimWorkResponse(body())
    expect(t).not.toBeNull()
    // the kept object must not carry the heavy siblings anywhere in it
    const s = JSON.stringify(t)
    expect(s.includes('x'.repeat(1000)), 'top-level self blob survived the trim').toBe(false)
    expect(s.includes('y'.repeat(1000)), 'top-level candidates blob survived the trim').toBe(false)
    expect(t!.candidates).toHaveLength(3)
  })

  it('a body with no comparison is null — "failed", NOT "empty result"', () => {
    expect(trimWorkResponse({ self: {}, candidates: [] })).toBeNull()
    expect(trimWorkResponse(null)).toBeNull()
    expect(trimWorkResponse({ comparison: { ranking: [], /* no candidates array */ } })).toBeNull()
  })

  it('reads percent/grade off match.forward when rankScore is absent', () => {
    const t = trimWorkResponse(body())!
    expect(t.candidates[0].rankScore).toBe(90)
    expect(t.candidates[0].grade).toBe('A')
    expect(t.candidates[0].ratingText).toBe('ดีมาก')
  })
})

describe('② rank — the order is the engine\'s, never ours', () => {
  it('follows comparison.ranking even though it disagrees with score order on every seat', () => {
    const t = trimWorkResponse(body())!
    expect(readRankedCandidates(t).map((c) => c.index)).toEqual([1, 2, 0])
    // the control: sorting by score would have produced this, and it must NOT be what we return
    const byScore = [...t.candidates].sort((a, b) => (b.rankScore ?? 0) - (a.rankScore ?? 0)).map((c) => c.index)
    expect(byScore).toEqual([0, 1, 2])
    expect(readRankedCandidates(t).map((c) => c.index)).not.toEqual(byScore)
  })

  it('a candidate ranking forgot is appended, never dropped', () => {
    const t = trimWorkResponse(body({ ranking: [2] }))!
    expect(readRankedCandidates(t).map((c) => c.index)).toEqual([2, 0, 1])
  })

  it('an index ranking points at that does not exist is ignored, and repeats do not duplicate', () => {
    const t = trimWorkResponse(body({ ranking: [9, 1, 1] }))!
    expect(readRankedCandidates(t).map((c) => c.index)).toEqual([1, 0, 2])
  })
})

describe('③ roles — three, or say which seat is empty', () => {
  it('three roles → complete, in the engine\'s own words (ทาง ก)', () => {
    const t = trimWorkResponse(body())!
    const r = readRoles(t.candidates[0])
    expect(r.complete).toBe(true)
    expect(r.missing).toBe(0)
    expect(r.roles.map((x) => x.perspective)).toEqual([
      'ตัวเรา → เจ้านาย', 'ลูกน้อง → ตัวเรา', 'หุ้นส่วน/เพื่อนร่วมงาน',
    ])
  })

  it('🔴 two roles → NOT complete, and it says one is missing instead of renumbering', () => {
    const t = trimWorkResponse(body({
      candidates: [{ index: 0, roles: [role('ตัวเรา → เจ้านาย'), role('หุ้นส่วน/เพื่อนร่วมงาน')] }],
    }))!
    const r = readRoles(t.candidates[0])
    expect(r.complete).toBe(false)
    expect(r.missing).toBe(1)
    expect(r.roles).toHaveLength(2)
  })

  it('a role without a perspective string is not counted as a role', () => {
    const t = trimWorkResponse(body({
      candidates: [{ index: 0, roles: [role('ตัวเรา → เจ้านาย'), { stageName: 'เจ๊าะ' }, null] }],
    }))!
    expect(readRoles(t.candidates[0]).missing).toBe(WORK_ROLE_COUNT - 1)
  })

  it('no candidate at all is missing all three, not a crash', () => {
    expect(readRoles(undefined)).toEqual({ roles: [], complete: false, missing: 3 })
  })
})
