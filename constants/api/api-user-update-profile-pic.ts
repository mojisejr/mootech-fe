import { callApi } from '../../utils/fetch'
import { API } from './endpoint'

export const UserUpdateProfilePic = async (user_id: string, url: string) => {
  try {
    const path_params = {
      user_id: user_id,
      url: url,
    }

    const response = await callApi(API.user.update_profile_pic, 'PUT', '', path_params, {})

    if (response.error) {
      return response
    }

    return response
  } catch (error: any) {
    return { error }
  }
}
