import { callApi } from '../../utils/fetch'
import { API } from './endpoint'
import { REQUEST_USER_REGISTER_TEL } from './request-user'
import { UnverifiedApiResult } from './unverified-result'

// #167 — UserRegisterTel CREATES a user and fires a real SMS via 8x8 (#184). We refuse to hit it, so its
// shape is unverified — honest loose type. (verify: can't — creates a user + live SMS.)
export const UserRegisterTel = async (tel: string, name: string, surname: string, refer_code: string): Promise<UnverifiedApiResult> => {
  try {
    const path_params = {
      tel: tel,
      name: name,
      surname: surname,
      refer_code: refer_code,
    } as REQUEST_USER_REGISTER_TEL

    const response = await callApi(API.user.register_tel, 'POST', '', path_params, {})

    if (response.error) {
      return response
    }

    return response as UnverifiedApiResult
  } catch (error: any) {
    return { error }
  }
}
