import { callApi } from '../../utils/fetch'
import { API } from './endpoint'
import { REQUEST_OTP_GET } from './request-otp'
import { UnverifiedApiResult } from './unverified-result'

// #167 — OTPGet fires a REAL SMS via 8x8 (#184: BE integrations are live). We refuse to hit it, so its
// shape is unverified — honest loose type (the old RESPONSE_OTP_GET was a guess). (verify: can't — live SMS.)
export const OTPGet = async (tel: string): Promise<UnverifiedApiResult> => {
  try {
    const path_params = {
      tel: tel,
    } as REQUEST_OTP_GET

    const response = await callApi(API.otp.get, 'POST', '', path_params, {})

    if (response.error) {
      return response
    }

    return response as UnverifiedApiResult
  } catch (error: any) {
    return { error }
  }
}
