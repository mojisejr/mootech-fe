import { callApi } from '../../utils/fetch'
import { LOCAL_API as API } from './endpoint-local' // not ./endpoint: keeps the retired BE entries out of v2's chunks (be-retirement 2b)

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
