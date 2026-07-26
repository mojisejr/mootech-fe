import { callApi } from '../../utils/fetch'
import { API } from './endpoint'
import { REQUEST_OTP_VERIFY } from './request-otp'
import { UnverifiedApiResult } from './unverified-result'

// #167 — OTPVerify needs a REAL OTP code (from a real SMS) and hits the live 8x8 flow (#184). We refuse to
// hit it, so its shape is unverified — honest loose type. (verify: can't — needs a real OTP / live provider.)
export const OTPVerify = async (ref_code: string, otp: string): Promise<UnverifiedApiResult> => {
  try {
    const path_params = {
      otp: otp,
      ref_code: ref_code,
    } as REQUEST_OTP_VERIFY

    const response = await callApi(API.otp.verify, 'POST', '', path_params, {})

    if (response.error) {
      return response
    }

    return response as UnverifiedApiResult
  } catch (error: any) {
    return { error }
  }
}
