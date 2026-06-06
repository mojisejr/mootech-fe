import { callApi } from '../../utils/fetch'
import { API } from './endpoint'
import { REQUEST_USER_REGISTER_TEL } from './request-user'
import { RESPONSE_USER_REGISTER_TEL } from './response-user'

export const UserRegisterTel = async (tel: string, name: string, surname: string, refer_code: string) => {
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

    return response as RESPONSE_USER_REGISTER_TEL
  } catch (error: any) {
    return { error }
  }
}
