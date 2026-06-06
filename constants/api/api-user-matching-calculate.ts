import { callApi } from '../../utils/fetch'
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
