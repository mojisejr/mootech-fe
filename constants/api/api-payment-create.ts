import { callApi } from '../../utils/fetch'
import { API } from './endpoint'

export const PaymentCreateApi = async (
  user_id: string,
  plan: string,
  package_code: string,
  package_name: string,
  amount: string,
  file: string,
  date: string,
  time: string,
  amount_slip: string,
  email: string
) => {
  try {
    const path_params = {
        user_id: user_id,
        email: email,
        payment: {
          plan: plan,
          package_code: package_code,
          package_name: package_name,
          amount: amount,
        },
        slip: {
          file: file,
          date: date,
          time: time,
          amount: amount_slip,
        }
    }

    const response = await callApi(API.payment.create, 'POST', '', path_params, {})

    if (response.error) {
      return response
    }

    return response
  } catch (error: any) {
    return { error }
  }
}
