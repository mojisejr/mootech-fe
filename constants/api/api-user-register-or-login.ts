import { callApi } from '../../utils/fetch'
import { API } from './endpoint'

export const UserRegisterOrLogin = async (
  id_token: string, 
  image: string, 
  name: string,
  refer_code: string, 
  email: string, 
  provider: string
) => {
  try {
    const path_params = {
        "idToken": id_token,
        "name": name,
        "image": image,
        "refer_code": refer_code,
        "email": email,
        "provider": provider
    }

    const response = await callApi(API.user.register_or_login, 'POST', '', path_params, {})

    if (response.error) {
      return response
    }

    return response
  } catch (error: any) {
    return { error }
  }
}
