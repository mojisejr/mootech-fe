// scripts/work-compare-callsite.test.ts — teeth at the CALL SITE of the quota/database decision
// (mootech-fe#593 item ①, ตู๋'s second mutant round on PR #592).
//
// 🔴 WHY THIS FILE EXISTS AT ALL, given scripts/work-comparison.test.ts ⑦ already has 9 assertions on
// `isQuotaRefusal`. Those assertions watch the FUNCTION. The bug that reached `main` lives at the place
// that CALLS it (lib/matching/work-compare-flow.ts:282). ตู๋ proved the gap by reverting only the call
// site — `if (!isQuotaRefusal(refusedByQuota, e))` back to `if (!refusedByQuota)` — and all 32
// assertions in the two existing files stayed green while the #263 bug was fully restored.
// A decision made of two parts needs teeth where the parts are combined, not only where each is defined.
//
// THE FAILURE BEING PINNED, in the user's words: our database dies mid-transaction, and the person is
// told "โควตาเต็ม" — so they wait out the rest of the month for a ceiling they never actually hit.
//
// The mechanism is drizzle's own: `transaction()` runs `rollback` inside its catch and rethrows whatever
// THAT produces. So when a rollback fails, the value escaping the block is a connection error while
// `refusedByQuota` is already true. The db mock below reproduces exactly that wrapper, not a paraphrase.
//
// MUTANT CONTRACT — the whole point of the file
//   B   call site → `if (!refusedByQuota) throw e`         → ② reddens  ← survived every other spec
//   B2  call site → `if (!(e instanceof QuotaRaceLost))`   → ③b reddens
//   B3  call site → `if (false) throw e` (swallow all)     → ②, ③, ③b, ④ redden
//   🔴 ③ (flag down + connection error) does NOT tell B2 apart from the real thing — both throw. The
//   half that only B2 drops is answered by ③b, where the flag is DOWN and the escaping error IS our
//   sentinel. I wrote this contract claiming ③ covered B2, fired it, and it stayed green: the mutant
//   list is a claim about assertions and has to be fired like one.
//   ① is NOT a mutant target. It is the control that proves the flag was really set — without it, a mock
//   that silently never reaches the in-transaction ceiling check would make ② pass under mutant B too.
import { describe, it, expect, vi, beforeEach } from 'vitest'

type Tx = Record<string, never>

const state = {
  /** what `countCompatibilityInMonth` answers, in call order: [advisory, inside the transaction] */
  counts: [0, 10] as number[],
  countCalls: 0,
  ceiling: 10 as number | null,
  lockCalls: 0,
  /** what the transaction's rollback path rethrows; null = let the original error escape */
  rollbackThrows: null as unknown,
  txRan: false,
}

vi.mock('next/config', () => ({ default: () => ({ publicRuntimeConfig: {}, serverRuntimeConfig: {} }) }))

const ME = { userId: 'u1', gender: 'MALE', dob: '1990-01-01', time: '10:00' }
const FRIEND = { id: 'f1', userId: 'u1', name: 'เพื่อน', surname: 'ก', pictureUrl: null, gender: 'FEMALE', dob: '1992-02-02', time: '11:00' }

vi.mock('@/lib/db', async () => {
  const schema = await import('@/lib/db/schema')
  const makeQuery = () => {
    const q: any = { _table: null }
    q.from = (t: any) => ((q._table = t), q)
    q.where = () => q
    q.limit = () => Promise.resolve(q._table === schema.user ? [ME] : [])
    q.then = (resolve: any) => {
      if (q._table === schema.memberWithFriend) return resolve([FRIEND])
      if (q._table === schema.user) return resolve([ME])
      return resolve([])
    }
    return q
  }
  return {
    db: {
      select: () => makeQuery(),
      // 🔴 drizzle's real shape: the callback's throw goes through rollback, and whatever rollback
      // produces is what escapes. That is the only reason a non-quota error can arrive with the flag up.
      transaction: async (cb: (tx: Tx) => Promise<void>) => {
        state.txRan = true
        try {
          await cb({} as Tx)
        } catch (e) {
          throw state.rollbackThrows ?? e
        }
      },
    },
    schema,
  }
})

vi.mock('@/lib/v2/subscription', () => ({
  resolveSubscription: async () => ({ isPaid: false, tier: null }),
}))

vi.mock('@/lib/v2/compat-quota', () => ({
  compatibilityCeilingFor: () => state.ceiling,
  countCompatibilityInMonth: async () => state.counts[Math.min(state.countCalls++, state.counts.length - 1)],
  lockCompatibilityFor: async () => {
    state.lockCalls++
  },
}))

vi.mock('@/lib/matching/bazi-work-client', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/matching/bazi-work-client')>()
  const role = (perspective: string) => ({ perspective, stageName: 'เจ๊าะ', narrative: 'ยาว ๆ' })
  return {
    ...real,
    fetchBaziWork: async () => ({
      self: {},
      candidates: [],
      comparison: {
        self: { elementTh: 'ดิน' },
        ranking: [0],
        candidates: [
          {
            index: 0,
            match: { forward: { percent: 90, grade: 'A', ratingText: 'ดีมาก', emoji: '🔥' } },
            roles: [role('ตัวเรา → เจ้านาย'), role('ลูกน้อง → ตัวเรา'), role('หุ้นส่วน/เพื่อนร่วมงาน')],
          },
        ],
      },
    }),
  }
})

import { runWorkCompare, QuotaRaceLost } from '@/lib/matching/work-compare-flow'
import { AI_MSG } from '@/lib/usage'

const CONNECTION_DEAD = new Error('Connection terminated unexpectedly')

beforeEach(() => {
  state.counts = [0, 10]
  state.countCalls = 0
  state.ceiling = 10
  state.lockCalls = 0
  state.rollbackThrows = null
  state.txRan = false
})

describe('⑧ จุดเรียก — ธงถูกตั้งแล้ว error คนละตัวหลุดออกมา ต้องไม่กลายเป็น "โควตาเต็ม"', () => {
  it('① control — ธงตั้ง + error ที่เราโยนเอง ⇒ คืน quota (พิสูจน์ว่ามอคก์ไปถึงด่านในทรานแซกชันจริง)', async () => {
    const out = await runWorkCompare({ userId: 'u1', friendIds: ['f1'] })
    expect(state.txRan, 'ทรานแซกชันต้องถูกเรียกจริง').toBe(true)
    expect(state.lockCalls, 'ต้องล็อกต่อผู้ใช้ก่อนนับรอบที่ผูกได้').toBe(1)
    expect(state.countCalls, 'ต้องนับสองรอบ: แนะนำ แล้วรอบที่ผูกในทรานแซกชัน').toBe(2)
    expect(out).toEqual({ ok: false, kind: 'quota', message: AI_MSG.OUT_OF_LIMIT_ALL })
  })

  it('🔴 ② ธงตั้ง แต่ rollback ล้ม ⇒ ต้อง throw ออกมา ❌ ห้ามคืน kind quota', async () => {
    state.rollbackThrows = CONNECTION_DEAD
    await expect(runWorkCompare({ userId: 'u1', friendIds: ['f1'] })).rejects.toThrow('Connection terminated')
    // ปักซ้ำแบบพลิกขั้ว: ผลลัพธ์ที่ห้ามเกิดคือการคืนค่าใด ๆ ออกมาแทนการโยน
    // ⚠️ ต้องรีเซ็ตตัวนับก่อน ไม่งั้นรอบสองจะถูกปฏิเสธที่ด่าน *แนะนำ* (บรรทัด 170) แล้วไม่เคยเข้าทรานแซกชันเลย
    // ⇒ จะได้ kind quota ที่ไม่เกี่ยวกับสิ่งที่ข้อนี้ตรวจ (ผมเจอเองตอนรันครั้งแรก)
    state.countCalls = 0
    const settled = await runWorkCompare({ userId: 'u1', friendIds: ['f1'] }).then(
      (v) => ({ threw: false, v }),
      () => ({ threw: true, v: null }),
    )
    expect(settled, 'ฐานข้อมูลล่มต้องไม่ถูกแปลงเป็นคำตอบว่าโควตาเต็ม').toEqual({ threw: true, v: null })
  })

  it('③ ธงไม่ได้ตั้ง (ยังไม่ชนเพดาน) แล้วเขียนล้ม ⇒ ต้อง throw เหมือนกัน', async () => {
    state.counts = [0, 0] // ไม่ชนเพดานทั้งสองรอบ ⇒ ธงไม่ถูกตั้ง
    state.rollbackThrows = CONNECTION_DEAD
    await expect(runWorkCompare({ userId: 'u1', friendIds: ['f1'] })).rejects.toThrow('Connection terminated')
  })

  it('🔴 ③b ธงไม่ได้ตั้ง แต่ตัวที่หลุดออกมาเป็น QuotaRaceLost ⇒ ยังต้อง throw (ครึ่งธงต้องมีจริง)', async () => {
    // ทางที่มันเกิด: เรายังไม่ชนเพดาน แต่ rollback ที่ล้มดันโยน sentinel ของเราออกมา
    // ถ้าตัวตัดสินดูแต่ *ชนิด* มันจะบอกผู้ใช้ว่าโควตาเต็ม ทั้งที่ไม่มีใครตัดสินใจปฏิเสธเลยสักคน
    state.counts = [0, 0] // ไม่ชนเพดาน ⇒ refusedByQuota ยังเป็น false
    state.rollbackThrows = new QuotaRaceLost('rollback ล้มแล้วพา sentinel ออกมา')
    await expect(runWorkCompare({ userId: 'u1', friendIds: ['f1'] })).rejects.toBeInstanceOf(QuotaRaceLost)
  })

  it('④ ธงตั้งได้เฉพาะเมื่อมีเพดาน — เพดาน null ⇒ ไม่ล็อก ไม่นับรอบสอง และ error ต้องหลุดออกมา', async () => {
    state.ceiling = null
    state.rollbackThrows = CONNECTION_DEAD
    await expect(runWorkCompare({ userId: 'u1', friendIds: ['f1'] })).rejects.toThrow('Connection terminated')
    expect(state.lockCalls).toBe(0)
    expect(state.countCalls, 'เพดาน null ⇒ ไม่มีการนับเลยสักรอบ').toBe(0)
  })

  it('⑤ ตัวจริงที่โยนเองต้องเป็นคลาสที่ export ไว้ ❌ ไม่ใช่ error ทั่วไปที่บังเอิญชื่อคล้าย', () => {
    expect(new QuotaRaceLost() instanceof Error).toBe(true)
  })
})
