import { callApi } from '../../utils/fetch'
import { API } from './endpoint'

export const UserRegisterLine = async (line_id: string, name: string, picture_url: string, refer_code: string) => {
  try {
    const path_params = {
      line_id: line_id,
      name: name,
      picture_url: picture_url,
      refer_code: refer_code,
    }

    const response = await callApi(API.user.register_line, 'POST', '', path_params, {})

    if (response.error) {
      return response
    }

    return response
  } catch (error: any) {
    return { error }
  }
}
