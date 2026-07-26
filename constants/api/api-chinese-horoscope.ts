import { callApi } from '../../utils/fetch'
import { API } from './endpoint'
import { REQUEST_CHINESE_HOROSCOPE_GET } from './request-chinese-horoscope'
import { UnverifiedApiResult } from './unverified-result'

// #167 — Calculate SAVES a chart to the DB, so we do NOT hit it to verify its shape (would mutate the
// stack μุน is capturing on). Its old `as RESPONSE_CHINESE_HOROSCOPE_GET` asserted the GET-verified shape
// for a POST we never verified — an unproven claim. Honest loose type; callers narrow. (verify: can't —
// mutates DB.)
export const ChineseHoroscopeCalculate = async (
  user_id: string,
  name: string,
  dob: string,
  time: string,
  gender: string,
  picture_url: any,
  surname: any,
  account_name: any,
  family_code: any,
): Promise<UnverifiedApiResult> => {
  try {
    const path_params = {
      user_id: user_id,
      name: name,
      dob: dob,
      time: time,
      gender: gender,
      picture_url: picture_url,
      surname: surname,
      account_name: account_name,
      family_code: family_code,
    } as REQUEST_CHINESE_HOROSCOPE_GET

    const response = await callApi(API.chinese_horoscope.calculate, 'POST', '', path_params, {})

    if (response.error) {
      return response
    }

    return response as UnverifiedApiResult
  } catch (error: any) {
    return { error }
  }
}
