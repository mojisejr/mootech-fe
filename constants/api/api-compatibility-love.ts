import { callApi } from '../../utils/fetch'
import { API } from './endpoint'
import { REQUEST_COMPATIBILITY_LOVE_GET } from './request-compatibility-love'
import { UnverifiedApiResult } from './unverified-result'

// #167 — CompatibilityLove WRITES to the DB (insertLogLoveMate + updateLoveMate burns a quota, verified in
// the BE service), so we do NOT hit it (would mutate the stack μุน is capturing on). Honest loose type.
// (verify: can't — mutates DB / burns quota.)
export const CompatibilityLoveGet = async (
  user_id: string,
  me_name: string, me_dob: string, me_time: string, me_gender: string,
  name: string, dob: string, time: string, gender: string

): Promise<UnverifiedApiResult> => {
  try {
    const path_params = {
      user_id: user_id,
      me: {
        name: me_name,
        dob: me_dob,
        time: me_time,
        gender: me_gender,
      },
      you: {
        name: name,
        dob: dob,
        time: time,
        gender: gender
      }
  } as REQUEST_COMPATIBILITY_LOVE_GET

    const response = await callApi(API.chinese_horoscope.compatibility_love, 'POST', '', path_params, {})

    if (response.error) {
      return response
    }

    return response as UnverifiedApiResult
  } catch (error: any) {
    return { error }
  }
}
