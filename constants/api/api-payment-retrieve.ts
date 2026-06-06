import { callApi } from '../../utils/fetch'
import { API } from './endpoint'

export const PaymentRetrieveApi = async (chargeId: string) => {
  try {
    const path_params = {
      chargeId: chargeId,
    }

    const response = await callApi(API.payment.retrieve, 'POST', '', path_params, {})

    if (response.error) {
      return response
    }

    return response;
  } catch (error: any) {
    return { error }
  }
}
