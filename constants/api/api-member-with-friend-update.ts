import { callApi } from '../../utils/fetch'
import { API } from './endpoint'

export const MemberWithFriendUpdateApi = async (
  friend_id: string, 
  image: string,
) => {
  try {
    const path_params = {
      friend_id: friend_id,
      image: image,
    }

    const response = await callApi(API.member_with_friend.update, 'PUT', '', path_params, {})

    if (response.error) {
      return response
    }

    return response
  } catch (error: any) {
    return { error }
  }
}
