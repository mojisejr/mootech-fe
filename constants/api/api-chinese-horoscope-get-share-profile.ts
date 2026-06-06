import { callApi } from '../../utils/fetch'
import { API } from './endpoint'

export const ChineseHoroscopeGetShareProfile = async (code: string) => {
  try {
    const path_params = {
      code: code,
    }

    const response = await callApi(API.chinese_horoscope.get_share_profile, 'GET', '', path_params, {})
    if (response.error) {
      return response
    }

    return response
  } catch (error: any) {
    return { error }
  }
}
