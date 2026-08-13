import { callApi, callApiWithStatus, type ApiResult } from '../../utils/fetch'
import { API } from './endpoint'

export const UserMatchingCalculateApi = async (
  user_id: string,
  friend_id: string,
  matching_type: string,
) => {
  try {
    const path_params = {
      user_id: user_id,
      friend_id: friend_id,
      matching_type: matching_type,
    }

    const response = await callApi(API.user_matching.calculate, 'POST', '', path_params, {})

    if (response.error) {
      return response
    }

    return response
  } catch (error: any) {
    return { error }
  }
}

// Status-aware variant for the compat result flow (#263) — same endpoint as UserMatchingCalculateApi
// but surfaces the HTTP status so calculateCompatibility can tell 410 (quota) / 5xx (system) / network
// apart. NEW export; the legacy UserMatchingCalculateApi above is untouched (pages/matching/index.tsx:95
// still uses it). Never throws (callApiWithStatus swallows into a tagged result).
export const UserMatchingCalculateWithStatusApi = async (
  user_id: string,
  friend_id: string,
  matching_type: string,
): Promise<ApiResult> => {
  const path_params = {
    user_id: user_id,
    friend_id: friend_id,
    matching_type: matching_type,
  }
  return callApiWithStatus(API.user_matching.calculate, 'POST', '', path_params, {})
}
