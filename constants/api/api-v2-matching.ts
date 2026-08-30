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
