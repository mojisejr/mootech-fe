import { callApi } from '../../utils/fetch'
import { API } from './endpoint'

export const MemberWithFriendGetApi = async (
  user_id: string, 
) => {
  try {
    const path_params = {
      user_id: user_id,
    }

    const response = await callApi(API.member_with_friend.get, 'GET', '', path_params, {})

    if (response.error) {
      return response
    }

    return response
  } catch (error: any) {
    return { error }
  }
}
