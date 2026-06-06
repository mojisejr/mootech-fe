import { callApi } from '../../utils/fetch'
import { API } from './endpoint'

export const PaymentPackageGet = async (code: any) => {
  try {
    const path_params = {
      code: code,
     }

    const response = await callApi(API.payment_package.get, 'GET', '', path_params, {})

    if (response.error) {
      return response
    }

    return response
  } catch (error: any) {
    return { error }
  }
}
