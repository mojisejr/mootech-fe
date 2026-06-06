import { callApi } from '../../utils/fetch'
import { API } from './endpoint'
import { REQUEST_USER_CHECK_LINE } from './request-user'
import { RESPONSE_USER_CHECK_LINE } from './response-user'

export const UserCheckLine = async (line_id: string, name: any, picture_url: any, refer_code: any) => {
  try {
    const path_params = {
      line_id: line_id,
      name: name,
      picture_url: picture_url,
      refer_code: refer_code,
    } as REQUEST_USER_CHECK_LINE

    const response = await callApi(API.user.check_line, 'POST', '', path_params, {})

    if (response.error) {
      return response
    }

    return response as RESPONSE_USER_CHECK_LINE
  } catch (error: any) {
    return { error }
  }
}
