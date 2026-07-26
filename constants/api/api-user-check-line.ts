import { callApi } from '../../utils/fetch'
import { API } from './endpoint'
import { REQUEST_USER_CHECK_LINE } from './request-user'
import { UnverifiedApiResult } from './unverified-result'

// #167 — UserCheckLine calls the live LINE API (#184) and is part of the register/login side-effect flow.
// We refuse to hit it, so its shape is unverified — honest loose type. (verify: can't — live LINE provider.)
export const UserCheckLine = async (line_id: string, name: any, picture_url: any, refer_code: any): Promise<UnverifiedApiResult> => {
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

    return response as UnverifiedApiResult
  } catch (error: any) {
    return { error }
  }
}
