// v2 ดวงสมพงษ์ client (#357) — the same-origin siblings of api-user-matching-*.ts.
// ADD-ONLY: the v1 modules next to this file are untouched and still point at mootech-be.
//
// 🔴 No `user_id` argument anywhere in this file, on purpose. v1 passed the subject in the request
// (api-user-matching-calculate.ts:9), which is forgeable; the v2 routes derive it from the signed
// session and ignore anything the client says about identity.
import { callApi, callApiWithStatus, type ApiResult } from '../../utils/fetch'
import { API } from './endpoint'

/** POST /api/v2/matching/calculate — status-aware, because 410 (quota) and 5xx (system/engine down)
 *  must stay distinguishable for the result screen (useCompatibilityResult.ts:203-206). */
export const V2MatchingCalculateApi = async (
  friend_id: string,
  matching_type: string,
): Promise<ApiResult> => {
  return callApiWithStatus(API.v2_matching.calculate, 'POST', '', { friend_id, matching_type }, {})
}

/** GET /api/v2/matching — the caller's own history. Resolves to the bare array v1 returned. */
export const V2MatchingGetApi = async () => {
  try {
    return await callApi(API.v2_matching.get, 'GET', '', {}, {})
  } catch (error: any) {
    return { error }
  }
}

/** GET /api/v2/matching/<matching_id> — one result. The id is a PATH segment here, not a query
 *  parameter as in v1 (`/user-matching/detail?matching_id=`). */
export const V2MatchingGetDetailApi = async (matching_id: string) => {
  try {
    const url = `${API.v2_matching.get_detail}/${encodeURIComponent(matching_id)}`
    return await callApi(url, 'GET', '', {}, {})
  } catch (error: any) {
    return { error }
  }
}

/**
 * GET /api/v2/matching/work/<matching_id> — #585, the colleague lane's stored result.
 *
 * 🔴 STATUS-AWARE, unlike its single-pair sibling above. This route answers 404 for "no such result"
 * and 5xx for "the stored readings do not line up with their people" (work/[id].ts refuses to serve a
 * best-effort list rather than risk showing one person's reading under another's face). Those two are
 * different sentences on screen, so collapsing them into `null` here would throw away the only thing
 * that tells them apart — the same defect the love lane's 410-vs-5xx split exists to prevent.
 */
export const V2MatchingWorkGetDetailApi = async (matching_id: string): Promise<ApiResult> => {
  const url = `${API.v2_matching.work}/${encodeURIComponent(matching_id)}`
  return callApiWithStatus(url, 'GET', '', {}, {})
}

/**
 * POST /api/v2/matching/work — #585 ก้อน 4, start a colleague comparison for up to three friends.
 *
 * 🔴 STATUS-AWARE, and it has to be: this route answers with SIX different meanings
 * (200 / 400 too-many / 404 no-friend / 410 quota / 422 unusable-birth / 503 engine-down) and the screen
 * says a different sentence for each. `callApi` would flatten all of them into a bare body and throw the
 * status away, which is the shape that let a database failure read as "โควตาเต็ม" one layer down
 * (mootech-fe#593). `readWorkCompareResult` in features/v2-service/work-compare-call.ts turns this result
 * into which-of-the-five; the words live on the screen.
 *
 * ⚠️ SIDE-EFFECTING AND SLOW. It spends a matching quota unit and takes ~8.4s for three people (measured,
 * mootech-fe#585). There is no in-flight guard here on purpose — the caller holds the fire-once latch,
 * the same division the single-pair calculate uses.
 */
export const V2MatchingWorkCreateApi = async (friend_ids: string[]): Promise<ApiResult> => {
  return callApiWithStatus(API.v2_matching.work, 'POST', '', { friend_ids }, {})
}
