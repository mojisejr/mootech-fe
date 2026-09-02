// #585 ก้อน 4 — teeth on the mapping from POST /api/v2/matching/work to which-of-the-five.
//
// 🔴 THE CASE THIS FILE EXISTS FOR IS THE LAST ONE. mootech-fe#593 was a database failure that reached
// the user as "โควตาเต็ม". It was fixed one layer down, and the cheapest way to bring it back is a tidy-up
// here that folds `engine-down` into `quota` or into a shared "ลองใหม่ภายหลัง". The 503-vs-410 case and
// the copy case in scripts/work-compare-copy.test.ts are the two that go red if anyone does.
//
// MUTANT CONTRACT — each flips real behaviour, each must go RED here:
//   W1  map 503 to 'quota'                                → engine-down-is-not-quota RED
//   W2  return ok on a 200 with no matching_id            → contract-violation RED
//   W3  map any 400 to 'too-many'                         → malformed-request-is-ours RED
//   W4  fall unknown statuses through to a named refusal  → unknown-status RED
import { describe, expect, it } from 'vitest'
import { readWorkCompareResult, type WorkCalcOutcome } from '@/features/v2-service/work-compare-call'
import type { ApiResult } from '@/utils/fetch'

const http = (status: number, data: unknown = {}): ApiResult => ({ ok: false, kind: 'http', status, data })
const okRes = (data: unknown): ApiResult => ({ ok: true, status: 200, data })
const reason = (o: WorkCalcOutcome) => (o.ok ? '(ok)' : o.reason)

describe('#585 ก้อน 4 — reading the colleague compare answer', () => {
  it('200 ที่มี matching_id คือสำเร็จ และคืน id ตัวนั้น', () => {
    expect(readWorkCompareResult(okRes({ ok: true, matching_id: 'm-9', entries: [] }))).toEqual({
      ok: true,
      matchingId: 'm-9',
    })
  })

  it('🔴 503 ต้องไม่กลายเป็น quota — เครื่องคำนวณล่ม ไม่ใช่สิทธิ์หมด', () => {
    // this is mootech-fe#593 restated at the screen's layer: the two must not converge
    expect(reason(readWorkCompareResult(http(503)))).toBe('engine-down')
    expect(reason(readWorkCompareResult(http(410)))).toBe('quota')
    expect(reason(readWorkCompareResult(http(503)))).not.toBe(reason(readWorkCompareResult(http(410))))
  })

  it('ห้าสาเหตุมาจากห้าสถานะ และไม่มีสองอันไหนชนกัน', () => {
    const got = [http(410), http(404), http(422), http(400, { max: 3 }), http(503)].map((r) =>
      reason(readWorkCompareResult(r)),
    )
    expect(got).toEqual(['quota', 'no-friend', 'unusable-birth', 'too-many', 'engine-down'])
    // assert the SET size too: five labels that collapsed to four would still pass a length check on the
    // array above, because the array keeps its five slots either way
    expect(new Set(got).size).toBe(5)
  })

  it('400 ที่ไม่มี max คือคำขอที่จอส่งผิดเอง ❌ ไม่ใช่ผู้ใช้เลือกเกิน', () => {
    // the route answers 400 for BOTH "more than three" and "friend_ids must be a non-empty array"
    // (pages/api/v2/matching/work/index.ts:34,37) — telling the user to remove someone when WE sent a
    // malformed body sends them to fix something that is not broken
    expect(reason(readWorkCompareResult(http(400, { error: 'friend_ids must be a non-empty array' })))).toBe('system')
    expect(reason(readWorkCompareResult(http(400, { max: 3 })))).toBe('too-many')
  })

  it('200 ที่ไม่มี matching_id คือสัญญาแตก ⇒ เป็นของเรา ไม่ใช่การปฏิเสธของผู้ใช้', () => {
    // there is no result route to open, so calling it a success strands the user on a loader
    for (const body of [{ ok: true }, { ok: true, matching_id: '' }, { ok: true, matching_id: 7 }, null]) {
      expect(reason(readWorkCompareResult(okRes(body)))).toBe('system')
    }
  })

  it('ไม่มีคำตอบเลย คือ network ❌ ไม่ใช่ system — เราไม่รู้ว่าเซิร์ฟเวอร์ทำไปแล้วหรือยัง', () => {
    expect(reason(readWorkCompareResult({ ok: false, kind: 'network', error: new Error('offline') }))).toBe('network')
  })

  it('สถานะที่ไม่รู้จัก ต้องไม่ตกลงไปที่เหตุผลที่มีชื่อ', () => {
    // guessing here is how a confident wrong sentence gets shown
    for (const st of [401, 418, 500, 502]) {
      expect(reason(readWorkCompareResult(http(st)))).toBe('system')
    }
  })
})
