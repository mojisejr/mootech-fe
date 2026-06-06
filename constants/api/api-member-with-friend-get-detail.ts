import { callApi } from '../../utils/fetch'
import { API } from './endpoint'

export const MemberWithFriendGetDetailApi = async (
  friend_id: string, 
) => {
  try {
    const path_params = {
      id: friend_id,
    }

    const response = await callApi(API.member_with_friend.get_detail, 'GET', '', path_params, {})

    if (response.error) {
      return response
    }

    return response
  } catch (error: any) {
    return { error }
  }
}
