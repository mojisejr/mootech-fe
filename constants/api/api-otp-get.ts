import { callApi } from '../../utils/fetch'
import { API } from './endpoint'
import { REQUEST_CHINESE_HOROSCOPE_GET } from './request-chinese-horoscope'
import { REQUEST_OTP_GET } from './request-otp'
import { RESPONSE_CHINESE_HOROSCOPE_GET } from './response-chinese-horoscope'
import { RESPONSE_OTP_GET } from './response-otp'

export const OTPGet = async (tel: string) => {
  try {
    const path_params = {
      tel: tel,
    } as REQUEST_OTP_GET

    const response = await callApi(API.otp.get, 'POST', '', path_params, {})

    if (response.error) {
      return response
    }

    return response as RESPONSE_OTP_GET
  } catch (error: any) {
    return { error }
  }
}
