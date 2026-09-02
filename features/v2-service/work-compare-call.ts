// features/v2-service/work-compare-call.ts — #585 ก้อน 4, reading the answer to POST /api/v2/matching/work.
//
// 🔴 WHY THIS IS A SEPARATE PURE FILE AND NOT A `switch` INSIDE THE SCREEN. The colleague lane can refuse
// a press for FIVE different reasons and they are not interchangeable to the person reading the screen:
//
//     quota           you have spent your allowance          — a retry costs, and cannot succeed
//     no-friend       that co-worker is not on your account  — nothing to retry until you fix the list
//     unusable-birth  a birth date is missing                — YOUR data, and you can go and complete it
//     too-many        more than three people                 — take one out and press again
//     engine-down     the calculation service is unavailable — nothing of yours is wrong, retry is free
//
// (`lib/matching/work-compare-flow.ts:55-61` on main is where those five are produced.)
//
// 🔴 THE ONE PAIR THAT MUST NEVER MERGE IS `engine-down` AND `quota`. That merge is not hypothetical: it
// is the bug mootech-fe#593 just fixed one layer down, where a database failure reached the user as
// "โควตาเต็ม". Fixing it in the API and then collapsing the two into a single "ลองใหม่ภายหลัง" here would
// move the same defect up one storey and leave the ticket closed. บอง named this risk when he handed the
// chunk over; `scripts/work-compare-call.test.ts` asserts the two produce different words, so a future
// tidy-up that unifies them goes red instead of shipping.
//
// The screen owns the WORDS. This file owns only "which of the five happened", so the mapping can be
// tested against real status codes without mounting anything.
import type { ApiResult } from '@/utils/fetch'

export type WorkCalcFailure =
  | 'quota'
  | 'no-friend'
  | 'unusable-birth'
  | 'too-many'
  | 'engine-down'
  /** no response at all — offline, timeout, CORS. We cannot know whether the server processed it. */
  | 'network'
  /** ours, and unclassified: a 500, an unexpected status, or a 2xx that broke its own contract. */
  | 'system'

export type WorkCalcOutcome =
  | { ok: true; matchingId: string }
  | { ok: false; reason: WorkCalcFailure }

/**
 * Turn the transport result into one of the five refusals, `network`, or `system`.
 *
 * The status codes are the ones `pages/api/v2/matching/work/index.ts` actually answers with (:55-72),
 * read from that file rather than assumed:
 *   200 ok · 400 too-many (carries `max`) · 404 no-friend · 410 quota · 422 unusable-birth · 503 engine-down
 *
 * 🔴 400 IS TWO DIFFERENT THINGS AND ONLY ONE OF THEM IS THE USER'S. The route answers 400 both for
 * "more than three people" and for "friend_ids must be a non-empty array" (:34), and the second is a
 * request THIS code built wrong. Telling someone to remove a co-worker when the screen sent a malformed
 * body would send them to fix something that is not broken, so the two are split on `max` — the only
 * thing that distinguishes them on the wire.
 *
 * ⚠️ ONLY ONE OF THE ROUTE'S TWO too-many BRANCHES ATTACHES `max`, AND THE LOAD-BEARING ONE IS NOT THE
 * ONE YOU WOULD GUESS. `pages/api/v2/matching/work/index.ts:37` (the early length guard) sends it;
 * `:63` (the flow's own `too-many`) does NOT. That is harmless TODAY only because :36-38 runs first and
 * shadows :63 for every request that could reach it. So the day someone deletes :36-38 as a duplicate of
 * the flow check — which is exactly what it looks like — a genuine too-many arrives here as a 400 with no
 * `max`, is read as `system`, and the user is told "ระบบขัดข้อง" instead of "เอาออกให้เหลือ 3 คน".
 * ตู๋ found this reviewing mootech-fe#589. The repair belongs at :63, in the route, and is reported to
 * บอง rather than worked around here: making this file guess from the message string would replace one
 * silent misread with a more fragile one. Written down because the hazard is invisible from either file
 * alone — it only exists in how the two branches overlap.
 */
export function readWorkCompareResult(res: ApiResult): WorkCalcOutcome {
  if (res.ok) {
    const id = (res.data as { matching_id?: unknown } | null)?.matching_id
    // A 2xx without the id is not a success we can act on: there is no result route to open. It is ours,
    // so it says so — never a refusal that would read as the user's fault.
    if (typeof id !== 'string' || id.trim() === '') return { ok: false, reason: 'system' }
    return { ok: true, matchingId: id }
  }
  if (res.kind === 'network') return { ok: false, reason: 'network' }
  switch (res.status) {
    case 410:
      return { ok: false, reason: 'quota' }
    case 404:
      return { ok: false, reason: 'no-friend' }
    case 422:
      return { ok: false, reason: 'unusable-birth' }
    case 400:
      return (res.data as { max?: unknown } | null)?.max === undefined
        ? { ok: false, reason: 'system' }
        : { ok: false, reason: 'too-many' }
    case 503:
      return { ok: false, reason: 'engine-down' }
    default:
      // 401/500/anything unmapped. Deliberately NOT a guess at which refusal it "probably" is: an unknown
      // status that lands on a specific refusal is how a wrong sentence gets shown with confidence.
      return { ok: false, reason: 'system' }
  }
}
