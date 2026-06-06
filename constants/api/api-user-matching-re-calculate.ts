import { callApi } from '../../utils/fetch'
import { API } from './endpoint'

export const UserMatchingReCalculateApi = async (
  matching_id: string,
) => {
  try {
    const path_params = {
      matching_id: matching_id
    }

    const response = await callApi(API.user_matching.re_calculate, 'POST', '', path_params, {})

    if (response.error) {
      return response
    }

    return response
  } catch (error: any) {
    return { error }
  }
}
