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

// ── ④ the merged join (มุน caught the defect at review) ────────────────────────────────────────────
//
// 🔴 WHAT THIS PROTECTS. Before this, the screen received TWO arrays — the engine's readings (carrying
// only `index`) and our people (carrying `slot`, name, picture) — and had to line them up by position.
// A wrong line-up does not crash: every name, every picture, every score renders, and only the READINGS
// belong to the wrong people. Nothing in TypeScript can see it, and nothing on screen looks broken.
//
// MUTANT CONTRACT
//   B1  buildWorkResult joins by array position instead of by index→slot   → ② reddens
//   B2  the set comparison is dropped (best-effort join)                    → ③ ④ redden
//   B3  entries come back in candidate order instead of ranking order       → ① reddens
//   B4  rank is 0-based                                                     → ① reddens
import { buildWorkResult } from '@/features/v2-service/work-comparison'

const person = (slot: number, name: string) => ({ slot, friendId: `f${slot}`, name, surname: 'x', pictureUrl: null })
const PEOPLE = [person(0, 'เอ'), person(1, 'บี'), person(2, 'ซี')]

describe('④ buildWorkResult — a reading and a person are ONE object', () => {
  it('① เรียงตาม ranking และ rank เป็นเลข 1 2 3 ที่ขึ้นจอ', () => {
    const t = trimWorkResponse(body())! // ranking [1,2,0]
    const b = buildWorkResult(t, PEOPLE)
    expect(b.ok).toBe(true)
    if (!b.ok) return
    expect(b.entries.map((e) => e.rank)).toEqual([1, 2, 3])
    expect(b.entries.map((e) => e.slot)).toEqual([1, 2, 0])
  })

  it('🔴 ② คนที่ติดมากับคำทำนาย ต้องมาจาก index ❌ ไม่ใช่ตำแหน่งในอาเรย์ผลลัพธ์', () => {
    const t = trimWorkResponse(body())! // ranking [1,2,0]
    const b = buildWorkResult(t, PEOPLE)
    if (!b.ok) throw new Error('expected ok')
    // อันดับ 1 คือ index 1 ⇒ ต้องเป็น "บี" ❌ ไม่ใช่ "เอ" ซึ่งคือคนที่อยู่ตำแหน่งแรกของอาเรย์คน
    expect(b.entries[0].person.name).toBe('บี')
    expect(b.entries[1].person.name).toBe('ซี')
    expect(b.entries[2].person.name).toBe('เอ')
  })

  it('🔴 ③ เซตไม่ตรงกัน = ปฏิเสธ ❌ ไม่ใช่ต่อเท่าที่ต่อได้', () => {
    const t = trimWorkResponse(body())!
    const b = buildWorkResult(t, [person(0, 'เอ'), person(1, 'บี')]) // ขาด slot 2
    expect(b.ok).toBe(false)
    if (b.ok) return
    expect(b.reason).toBe('index-slot-mismatch')
    expect(b.detail).toContain('0,1,2')
  })

  it('🔴 ④ จำนวนเท่ากันแต่คนละเซต ก็ต้องปฏิเสธ — จำนวนตรงคือเคสที่ไม่มีอะไรให้สะดุด', () => {
    const t = trimWorkResponse(body())!
    const b = buildWorkResult(t, [person(0, 'เอ'), person(1, 'บี'), person(7, 'ผิด')])
    expect(b.ok, 'สาม == สาม แต่ 7 ไม่ใช่ 2 ⇒ ต้องไม่ผ่าน').toBe(false)
  })

  it('⑤ roles ที่ขาด เดินทางมาถึง entry ด้วย ไม่ได้หายระหว่าง join', () => {
    const t = trimWorkResponse(body({
      ranking: [0],
      candidates: [{ index: 0, roles: [role('ตัวเรา → เจ้านาย')] }],
    }))!
    const b = buildWorkResult(t, [person(0, 'เอ')])
    if (!b.ok) throw new Error('expected ok')
    expect(b.entries[0].rolesComplete).toBe(false)
    expect(b.entries[0].rolesMissing).toBe(2)
  })
})

// ── ⑤ ของที่ตู๋จับได้ใน mootech-fe#593 ─────────────────────────────────────────────────────────────
//
// สองข้อนี้เป็นคนละกลไกกัน แต่มีรูปเดียวกัน: **ของที่เราแต่งขึ้นเอง ใส่เสื้อของเอนจิน**
//   ③ ranking มาไม่ครบ → เราเติมคนที่หายต่อท้าย แล้วปั๊มเลขอันดับทับเหมือนกันหมด
//   ② slot กลับด้านตอนเขียนลงฐานข้อมูล → ด่านเทียบ *เซต* มองไม่เห็น เพราะการสลับรักษาเซตไว้ครบ
//
// MUTANT CONTRACT
//   C1  rankFromEngine เป็น true เสมอ                        → ② reddens
//   C2  rankingComplete เป็น true เสมอ                       → ① reddens
//   C3  workCandidateRows กลับด้าน slot (ท่าของตู๋)            → ③ reddens  ← ก่อนหน้านี้รอด
//   C4  workCandidateRows ใช้ friendIds เรียงกลับด้าน          → ③ reddens
import { workCandidateRows } from '@/lib/matching/work-compare-flow'

describe('⑤ อันดับที่มาจากเอนจิน กับอันดับที่เราเติมเอง ต้องแยกออกจากกัน', () => {
  it('① ranking เอ่ยถึงครบทุกคน ⇒ rankingComplete = true และทุกใบ rankFromEngine', () => {
    const t = trimWorkResponse(body())! // ranking [1,2,0] ครบ 3
    const b = buildWorkResult(t, PEOPLE)
    if (!b.ok) throw new Error('expected ok')
    expect(b.rankingComplete).toBe(true)
    expect(b.entries.every((e) => e.rankFromEngine)).toBe(true)
  })

  it('🔴 ② ranking เอ่ยถึงคนเดียว ⇒ อีกสองใบต้องบอกว่าอันดับนี้เราเติมเอง', () => {
    const t = trimWorkResponse(body({ ranking: [2] }))!
    const b = buildWorkResult(t, PEOPLE)
    if (!b.ok) throw new Error('expected ok')
    expect(b.rankingComplete, 'ranking ไม่ครบ ⇒ ต้องไม่ใช่ complete').toBe(false)
    // ใบแรกมาจากเอนจินจริง อีกสองใบเราเติม
    expect(b.entries.map((e) => [e.slot, e.rankFromEngine])).toEqual([[2, true], [0, false], [1, false]])
  })

  it('② ranking ว่างเปล่า ⇒ ไม่มีใบไหนอ้างได้ว่าอันดับมาจากเอนจิน', () => {
    const t = trimWorkResponse(body({ ranking: [] }))!
    const b = buildWorkResult(t, PEOPLE)
    if (!b.ok) throw new Error('expected ok')
    expect(b.rankingComplete).toBe(false)
    expect(b.entries.some((e) => e.rankFromEngine)).toBe(false)
  })
})

describe('⑥ workCandidateRows — แถวที่ i ต้องเป็นเพื่อนคนที่ i ที่เราส่งเข้าเอนจิน', () => {
  const rankById = new Map<number, number | undefined>([[0, 10], [1, 20], [2, 30]])

  it('🔴 ③ slot ต้องเท่ากับตำแหน่งในอาเรย์ และ friendId ต้องเป็นคนที่ตำแหน่งนั้น', () => {
    const rows = workCandidateRows({
      matchingId: 'm1',
      friendIds: ['fA', 'fB', 'fC'],
      rankById,
      timeKnown: [true, false, true],
    })
    // ปักทีละคู่ ⇒ ทั้งการกลับด้าน slot และการกลับด้าน friendIds ต่างก็แดง
    expect(rows.map((r) => [r.slot, r.friendId])).toEqual([[0, 'fA'], [1, 'fB'], [2, 'fC']])
    expect(rows.map((r) => r.rankScore)).toEqual([10, 20, 30])
    expect(rows.map((r) => r.timeKnown)).toEqual([true, false, true])
    expect(rows.every((r) => r.matchingId === 'm1')).toBe(true)
  })

  it('④ ไม่รู้ timeKnown ของ slot นั้น ⇒ ถือว่ารู้เวลา ❌ ไม่ใช่ undefined ลงคอลัมน์ NOT NULL', () => {
    const rows = workCandidateRows({ matchingId: 'm1', friendIds: ['fA'], rankById, timeKnown: [] })
    expect(rows[0].timeKnown).toBe(true)
  })
})

// ── ⑦ ตัวตัดสินว่า "โควตาเต็ม" หรือ "ฐานข้อมูลเราพัง" (ตู๋ #593 ข้อ ①) ───────────────────────────────
//
// 🔴 ข้อนี้แตะเงินและแตะความไว้ใจ: ถ้าตอบผิด ผู้ใช้ที่ยังมีสิทธิ์เหลือจะถูกบอกว่าโควตาเต็ม
// ทั้งที่ฐานข้อมูลของเราต่างหากที่ล่ม ⇒ เขาจะรอไปทั้งเดือนโดยไม่มีใครรู้ว่าเราพัง
//
// ทางที่มันเกิดจริง drizzle รัน rollback ใน catch ของตัวเองแล้วโยนสิ่งที่ rollback ให้ออกมา
// ⇒ rollback ล้มเมื่อไหร่ ตัวที่หลุดออกมาคือ error ของคอนเนกชัน ในขณะที่ธงถูกตั้งไปแล้ว
//
// MUTANT CONTRACT
//   Q1  ตัดเงื่อนไขชนิดทิ้ง เหลือแต่ธง (รูปเดิมก่อนแก้)   → ② reddens
//   Q2  ตัดเงื่อนไขธงทิ้ง เหลือแต่ชนิด                    → ③ reddens
import { isQuotaRefusal, QuotaRaceLost } from '@/lib/matching/work-compare-flow'

describe('⑦ isQuotaRefusal — ต้องครบทั้งสองครึ่ง', () => {
  // 🔑 คลาสที่หน้าตาเหมือนแต่คนละตัว — ถ้าตัวตัดสินเผลอเทียบด้วยชื่อหรือรูปร่าง ตัวนี้จะหลุด
  class QuotaRaceLost2 extends Error {}

  it('① ธงตั้ง + เป็น error ที่เราโยนเอง ⇒ ใช่ โควตาเต็ม  ← ขาดข้อนี้ มิวแทนต์ return false รอด', () => {
    expect(isQuotaRefusal(true, new QuotaRaceLost())).toBe(true)
  })

  it('①b คลาสคนละตัวที่หน้าตาเหมือนกัน ต้องไม่ผ่าน', () => {
    expect(isQuotaRefusal(true, new QuotaRaceLost2())).toBe(false)
  })

  it('🔴 ② ธงตั้ง แต่เป็น error คนละตัว (rollback ล้ม) ⇒ ต้องไม่ใช่โควตา', () => {
    expect(isQuotaRefusal(true, new Error('Connection terminated'))).toBe(false)
    expect(isQuotaRefusal(true, { code: 'ECONNRESET' })).toBe(false)
    expect(isQuotaRefusal(true, undefined)).toBe(false)
  })

  it('③ ธงไม่ได้ตั้ง ⇒ ต้องไม่ใช่โควตา ไม่ว่า error จะเป็นอะไร', () => {
    expect(isQuotaRefusal(false, new Error('anything'))).toBe(false)
    expect(isQuotaRefusal(false, new QuotaRaceLost()), 'ตัวจริงแต่ธงไม่ได้ตั้ง ⇒ ยังไม่ใช่').toBe(false)
  })
})
