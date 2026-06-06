import { callApi } from '../../utils/fetch'
import { API } from './endpoint'
import { REQUEST_OTP_VERIFY } from './request-otp'
import { RESPONSE_OTP_VERIFY } from './response-otp'

export const OTPVerify = async (ref_code: string, otp: string) => {
  try {
    const path_params = {
      otp: otp,
      ref_code: ref_code,
    } as REQUEST_OTP_VERIFY

    const response = await callApi(API.otp.verify, 'POST', '', path_params, {})

    if (response.error) {
      return response
    }

    return response as RESPONSE_OTP_VERIFY
  } catch (error: any) {
    return { error }
  }
}
