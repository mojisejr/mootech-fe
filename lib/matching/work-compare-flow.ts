// The colleague lane: compute + persist (mootech-fe#585). Sibling of ./calculate-flow, and deliberately
// the same SHAPE — ฟีม's instruction on 2026-09-01 was "ยังให้ความสัมพันธ์ และ ความปลอดภัย ราบรื่นยังอยู่
// เหมือนเดิม" while not touching the old table. So every safety property of the pair lane is carried over
// literally, and only the STORAGE is new.
//
// SAME AS THE PAIR LANE, ON PURPOSE
//   order        advisory quota → engine → writes. The meter row is written only after the engine answers,
//                so an engine outage can never charge a unit (calculate-flow.ts header).
//   binding gate the second count runs INSIDE the write transaction under `lockCompatibilityFor`, because
//                the cheap pre-check cannot bind across an 8.4s engine call. mootech-be#21 measured 454
//                users past their ceiling on prod through exactly the un-locked shape.
//   scoping      every friend is looked up WITH `userId` in the predicate. An id alone must never be
//                matchable (#252/#273/be#16).
//   one press    one `user_matching` row ⇒ `lib/v2/compat-quota.ts:46-52` counts this press with no change
//                on its side: it counts every row in the month and does not filter `matching_type`.
//                ฟีมเคาะ: กด 1 ครั้งเทียบได้ถึง 3 คน = 1 หน่วย.
//
// DIFFERENT, AND WHY
//   🔴 no log_matching row. Its friend-side columns are singular and NOT NULL (`your_name`, `your_dob`,
//      `your_time`, `your_is_remember_time`, `your_gender` — schema.ts:426-442). Three colleagues cannot
//      go in without picking one and discarding two. ฟีมเคาะ 2026-09-01: leave that table alone.
//   🔴 `user_matching.friend_id` is NOT NULL (schema.ts:1051), so the meter row still carries ONE friend
//      id: the candidate in slot 0. That value is inert — the only reader of `user_matching` outside this
//      lane is the counter, which selects `count(*)` (compat-quota.ts:46-52), and mootech-be reads it only
//      through `logMatchingRepository`-driven joins (matching.service.ts:234,318,357), which our rows are
//      absent from. It is recorded here so nobody later mistakes it for the answer to "who was compared".
//      The real list is `work_comparison_candidate`.
import { and, eq, inArray, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { logActivity, memberWithFriend, user, userMatching, workComparison, workComparisonCandidate } from '@/lib/db/schema'
import { AI_MSG, bkkTimestamp } from '@/lib/usage'
import { resolveSubscription } from '@/lib/v2/subscription'
import { compatibilityCeilingFor, countCompatibilityInMonth, lockCompatibilityFor } from '@/lib/v2/compat-quota'
import { BaziEngineError } from './bazi-client'
import { fetchBaziWork, MAX_CANDIDATES, type BaziRawInput } from './bazi-work-client'
import { normalizeDate, normalizeGender, normalizeTime } from './bazi-pair.mapper'
import { trimWorkResponse, readRankedCandidates, buildWorkResult, type WorkComparison, type WorkEntry } from '@/features/v2-service/work-comparison'

/**
 * The `matching_type` written on the meter row.
 *
 * 🔴 A NEW VALUE, not one of LOVE/BOSS/EMPLOYEE/FRIEND. Reusing one of those would make this press
 * indistinguishable from a pair press in every row that carries the type, and `matchTypeLabel`
 * (features/v2-service/compatibility-recent.ts:30-33) would then print a chip claiming the run was
 * something it was not. An unknown type there returns `undefined` and the card hides the chip (D43),
 * which is the correct behaviour until the colleague card gets a label of its own.
 */
export const WORK_COMPARE_TYPE = 'WORK_COMPARE'

// Same economy as the pair lane's work domain — this is a work-domain reading, so activity id 3
// (calculate-flow.ts:66,71). Changing the points economy is not this ticket's business.
const WORK_ACTIVITY_ID = 3
const MATCHING_POINT_COST = 10

export type WorkCompareOutcome =
  | { ok: true; matchingId: string; entries: WorkEntry[]; rankingComplete: boolean }
  | { ok: false; kind: 'quota'; message: string }
  | { ok: false; kind: 'no-friend' }
  | { ok: false; kind: 'unusable-birth' }
  | { ok: false; kind: 'too-many'; max: number }
  | { ok: false; kind: 'engine-down'; detail: string }

/**
 * The throw that carries "this press is refused because the ceiling was already reached".
 *
 * Exported ONLY so `isQuotaRefusal` can be tested in both directions. A spec that can assert the false
 * cases but never the true one is satisfied by `return false`, which is a tooth with no bite.
 */
export class QuotaRaceLost extends Error {}

/**
 * Does this thrown value mean "the user is out of quota", or does it mean "our database broke"?
 *
 * 🔴 IT IS A NAMED FUNCTION SO IT CAN BE TESTED. The bug ตู๋ found on mootech-fe#593 was that this
 * decision was one inline `if` on the FLAG alone. drizzle runs `rollback` inside its own catch and
 * rethrows whatever that produces, so a failed rollback escapes as a connection error while the flag is
 * already true — and the user is told "โควตาเต็ม" because our database died. That is the #263 shape.
 *
 * ⇒ BOTH halves are required: the flag says we decided to refuse, the type says this is the throw we
 * made to carry that decision. Anything else must keep travelling.
 */
export function isQuotaRefusal(refusedByQuota: boolean, e: unknown): boolean {
  return refusedByQuota && e instanceof QuotaRaceLost
}

/** what the pair lane's route substitutes when the hour is unknown (`pair-match/route.ts:119`) */
const WORK_DEFAULT_BIRTH_TIME = '12:00'

function toRawInput(p: { gender?: string | null; dob?: string | null; time?: string | null }): { input: BaziRawInput; timeKnown: boolean } | null {
  const birthDate = normalizeDate(p?.dob ?? undefined)
  if (!birthDate) return null
  const birthTime = normalizeTime(p?.time ?? undefined)
  return {
    input: {
      birthDate,
      // 🔴 NOON WHEN THE HOUR IS UNKNOWN, and the caller MUST carry `timeKnown` outward.
      // Measured 2026-09-02 against the real endpoint: `/api/bazi/work` rejects both an omitted key
      // (`expected string, received undefined`) and `''` (`too_small`). Its sibling `/api/bazi/pair-match`
      // accepts an absent hour, substitutes noon itself, and reports `timeKnown:false`
      // (`pair-match/route.ts:41,119,159`) — the work endpoint simply never got that mode.
      // ⇒ we apply the SAME noon the pair lane has always applied, so the number is not a new invention,
      // and we carry the flag ourselves because this endpoint will not.
      birthTime: birthTime || WORK_DEFAULT_BIRTH_TIME,
      gender: normalizeGender(p?.gender ?? undefined),
      province: 'กรุงเทพมหานคร',
    },
    timeKnown: !!birthTime,
  }
}

/**
 * The rows that go into `work_comparison_candidate`, built from ONE array in ONE place.
 *
 * 🔴 WHY THIS IS A FUNCTION AND NOT FOUR LINES INSIDE THE TRANSACTION. `slot` is the join key between a
 * person and the reading the engine computed for them: the engine numbers its answers by the POSITION we
 * sent the candidates in, and this is where that position becomes a stored fact. ตู๋ showed on
 * mootech-fe#593 that reversing `slot` here left every test green — the set-equality gate in
 * `buildWorkResult` compares SETS, and a swap preserves the set. So the gate catches a person going
 * MISSING or an EXTRA one appearing; it cannot catch two people trading places.
 *
 * Pulling it out makes "the i-th row describes the i-th friend we sent" a single statement with teeth on
 * it (scripts/work-comparison.test.ts), instead of a coincidence spread across two call sites.
 */
export function workCandidateRows(args: {
  matchingId: string
  /** friend ids in the order they were sent to the engine — index IS the slot */
  friendIds: string[]
  rankById: Map<number, number | undefined>
  timeKnown: boolean[]
}) {
  return args.friendIds.map((friendId, slot) => ({
    matchingId: args.matchingId,
    slot, // the order the USER typed ❌ not the rank — rank lives in comparison.ranking
    friendId,
    rankScore: args.rankById.get(slot) ?? null,
    timeKnown: args.timeKnown[slot] ?? true,
  }))
}

export async function runWorkCompare(params: {
  userId: string
  /** friend ids in the order the user typed them — becomes `slot` 0..n */
  friendIds: string[]
  now?: Date
}): Promise<WorkCompareOutcome> {
  const now = params.now ?? new Date()

  // De-duplicate while KEEPING the typed order: comparing someone against themselves twice would spend a
  // slot the engine caps at 3 and produce two identical cards.
  const seen = new Set<string>()
  const friendIds: string[] = []
  for (const raw of params.friendIds) {
    const id = String(raw ?? '').trim()
    if (!id || seen.has(id)) continue
    seen.add(id)
    friendIds.push(id)
  }
  if (friendIds.length < 1) return { ok: false, kind: 'no-friend' }
  if (friendIds.length > MAX_CANDIDATES) return { ok: false, kind: 'too-many', max: MAX_CANDIDATES }

  // 1. advisory quota — cheap, so a user who is already out never costs an 8.4s engine call.
  let verdict: { isPaid: boolean | null; tier: string | null } = { isPaid: false, tier: null }
  try {
    const v = await resolveSubscription(params.userId)
    verdict = { isPaid: v.isPaid, tier: v.tier }
  } catch {
    verdict = { isPaid: false, tier: null } // fail-closed, same as the pair lane
  }
  const ceiling = compatibilityCeilingFor(verdict)
  if (ceiling !== null && (await countCompatibilityInMonth(params.userId, now)) >= ceiling) {
    return { ok: false, kind: 'quota', message: AI_MSG.OUT_OF_LIMIT_ALL }
  }

  // 2. the people. 🔴 Friends are scoped to the CALLER in the predicate, never by id alone.
  const [me] = await db.select().from(user).where(eq(user.userId, params.userId)).limit(1)
  const friends = await db
    .select()
    .from(memberWithFriend)
    .where(and(inArray(memberWithFriend.id, friendIds), eq(memberWithFriend.userId, params.userId)))
  if (!me || friends.length !== friendIds.length) {
    // ⚠️ A partial match is a REFUSAL, not a smaller comparison. Silently dropping the friend that did not
    // belong to this caller would answer a question the user did not ask, and would hide the mismatch.
    return { ok: false, kind: 'no-friend' }
  }
  const byId = new Map(friends.map((f) => [String(f.id), f]))
  const ordered = friendIds.map((id) => byId.get(id)!)

  // 3. build the engine request. A birth date we cannot use = refuse; there is no legacy fallback here.
  const self = toRawInput({ gender: me.gender, dob: me.dob, time: me.time })
  const mapped = ordered.map((f) => toRawInput({ gender: f.gender, dob: f.dob, time: f.time }))
  if (!self || mapped.some((c) => !c)) return { ok: false, kind: 'unusable-birth' }
  const candidates = (mapped as { input: BaziRawInput; timeKnown: boolean }[]).map((c) => c.input)
  const timeKnown = (mapped as { input: BaziRawInput; timeKnown: boolean }[]).map((c) => c.timeKnown)

  // 4. the engine. Any failure = engine-down, nothing written, no quota spent.
  let comparison: WorkComparison | null
  try {
    const raw = await fetchBaziWork({ self: self.input, candidates })
    comparison = trimWorkResponse(raw) // 🔴 the ~7MB body dies HERE, on the server
  } catch (e) {
    const detail = e instanceof BaziEngineError ? e.message : String((e as Error)?.message ?? e)
    return { ok: false, kind: 'engine-down', detail }
  }
  if (!comparison || comparison.candidates.length === 0) {
    // "no comparison" ≠ "an empty comparison" — the first means the engine did not really answer.
    return { ok: false, kind: 'engine-down', detail: 'bazi work returned no comparison' }
  }

  // 4b. 🔴 JOIN BEFORE WRITING, AND REFUSE HERE IF IT DOES NOT LINE UP.
  // The readings carry only a position (`index`); the people carry a position (`slot`). If those two sets
  // disagree, every downstream screen would show one person's reading under another person's name and
  // photo — and it would look completely normal. Checking it AFTER the transaction would mean the user has
  // already been charged for something we then refuse to show, so the check sits before the first insert:
  // nothing written, no quota spent, and the failure reads as "we could not compute", which is true.
  const people = friendIds.map((friendId, slot) => {
    const f = ordered[slot]
    return { slot, friendId, name: f?.name, surname: f?.surname, pictureUrl: f?.pictureUrl, timeKnown: timeKnown[slot] }
  })
  const built = buildWorkResult(comparison, people)
  if (!built.ok) {
    return { ok: false, kind: 'engine-down', detail: `${built.reason}: ${built.detail}` }
  }

  // 5. the writes — one transaction, the binding quota check inside it under the per-user lock.
  const matchingId = crypto.randomUUID()
  const createAt = bkkTimestamp(now)
  const rankById = new Map(readRankedCandidates(comparison).map((c) => [c.index, c.rankScore]))

  let refusedByQuota = false
  try {
    await db.transaction(async (tx) => {
      if (ceiling !== null) {
        await lockCompatibilityFor(tx, params.userId)
        if ((await countCompatibilityInMonth(params.userId, now, tx)) >= ceiling) {
          refusedByQuota = true
          throw new QuotaRaceLost()
        }
      }

      // the meter row — this is the ONLY thing the quota counter sees, and it is enough
      await tx.insert(userMatching).values({
        id: matchingId,
        userId: params.userId,
        friendId: friendIds[0], // inert representative; the real list is work_comparison_candidate
        matchingType: WORK_COMPARE_TYPE,
        createAt,
      })

      await tx.insert(workComparison).values({
        matchingId,
        userId: params.userId,
        result: JSON.stringify(comparison),
        createAt,
      })

      await tx.insert(workComparisonCandidate).values(
        workCandidateRows({ matchingId, friendIds, rankById, timeKnown }),
      )

      await tx
        .update(user)
        .set({ usedPoint: sql`${user.usedPoint} + ${MATCHING_POINT_COST}` })
        .where(eq(user.userId, params.userId))

      await tx.insert(logActivity).values({
        createat: createAt,
        activityId: WORK_ACTIVITY_ID,
        point: -MATCHING_POINT_COST,
        userId: params.userId,
      })
    })
  } catch (e) {
    // 🔴 Only OUR sentinel becomes a refusal. Anything else is a real database failure and must keep
    // travelling — swallowing it would report "โควตาเต็ม" for a dead connection (#263 one layer down).
    //
    // 🔴 BOTH HALVES, NOT JUST THE FLAG. ตู๋ caught this on mootech-fe#593: the flag alone is not the
    // sentinel. drizzle's transaction wrapper runs `rollback` inside its own catch and rethrows whatever
    // THAT produces — so if the rollback fails, the error escaping this block is a connection error while
    // `refusedByQuota` is already true, and a dead database would have been reported to the user as
    // "โควตาเต็ม". Exactly the #263 shape this comment claims to prevent, rebuilt one layer down.
    // The pair lane has always checked both (`calculate-flow.ts:246`); this lane checked only the flag.
    if (!isQuotaRefusal(refusedByQuota, e)) throw e
    return { ok: false, kind: 'quota', message: AI_MSG.OUT_OF_LIMIT_ALL }
  }

  return { ok: true, matchingId, entries: built.entries, rankingComplete: built.rankingComplete }
}
