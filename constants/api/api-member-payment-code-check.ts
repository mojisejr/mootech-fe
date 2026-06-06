import { callApi } from '../../utils/fetch'
import { API } from './endpoint'

export const MemberPaymentCodeCheckApi = async (
  user_id: string, 
  code: string
) => {
  try {
    const path_params = {
      user_id: user_id,
      code: code,
    }

    const response = await callApi(API.member_payment_code.check, 'POST', '', path_params, {})

    if (response.error) {
      return response
    }

    return response
  } catch (error: any) {
    return { error }
  }
}
