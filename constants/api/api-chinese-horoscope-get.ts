import { callApi } from '../../utils/fetch'
import { API } from './endpoint'
import { RESPONSE_CHINESE_HOROSCOPE_GET } from './response-chinese-horoscope'

export const ChineseHoroscopeGet = async (userId: string, code: string) => {
  try {
    const path_params = {
      userId: userId,
      code: code,
    }

    const response = await callApi(API.chinese_horoscope.get, 'GET', '', path_params, {})
    if (response.error) {
      return response
    }

    return response as RESPONSE_CHINESE_HOROSCOPE_GET
  } catch (error: any) {
    return { error }
  }
}
