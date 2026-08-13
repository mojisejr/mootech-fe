import { callApi, callApiWithStatus, type ApiResult } from '../../utils/fetch'
import { API } from './endpoint'

export const MemberWithFriendUpdateProfileApi = async (
  friend_id: string, 
  dob: string, 
  name: string,
  surname: string,
  time: string,
  gender: string, 
  is_remember_time: boolean,
) => {
  try {
    const path_params = {
      friend_id: friend_id,
      dob: dob,
      time: time,
      gender: gender,
      is_remember_time: is_remember_time,
      name: name,
      surname: surname,
    }

    const response = await callApi(API.member_with_friend.update_profile, 'PUT', '', path_params, {})

    if (response.error) {
      return response
    }

    return response
  } catch (error: any) {
    return { error }
  }
}

// Status-aware variant for the Phase 4 edit-friend seam (#266) — same endpoint/args as
// MemberWithFriendUpdateProfileApi but surfaces the HTTP status so the caller can tell the user WHY a
// save failed (system vs network), in the same language #263 gave the whole line. NEW export; the legacy
// wrapper above is untouched. Never throws (callApiWithStatus swallows into a tagged result).
export const MemberWithFriendUpdateProfileWithStatusApi = async (
  friend_id: string,
  dob: string,
  name: string,
  surname: string,
  time: string,
  gender: string,
  is_remember_time: boolean,
): Promise<ApiResult> => {
  const path_params = {
    friend_id,
    dob,
    time,
    gender,
    is_remember_time,
    name,
    surname,
  }
  return callApiWithStatus(API.member_with_friend.update_profile, 'PUT', '', path_params, {})
}
