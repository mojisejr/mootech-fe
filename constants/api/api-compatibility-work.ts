import { callApi } from '../../utils/fetch'
import { API } from './endpoint'
import { REQUEST_COMPATIBILITY_LOVE_GET } from './request-compatibility-love'
import { UnverifiedApiResult } from './unverified-result'

// #167 — CompatibilityWork WRITES to the DB (same log/quota family as love), so we do NOT hit it. Honest
// loose type. Note the OLD cast used RESPONSE_COMPATIBILITY_LOVE_GET (the LOVE type on a WORK response — a
// copy-paste that the blind `as` hid); moot now, both are unverified. (verify: can't — mutates DB.)
export const CompatibilityWorkGet = async (
  user_id: string,
  me_name: string, me_dob: string, me_time: string, me_gender: string,
  name: string, dob: string, time: string, gender: string,
  type: string

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
      },
      type: type,
  } as REQUEST_COMPATIBILITY_LOVE_GET

    const response = await callApi(API.chinese_horoscope.compatibility_work, 'POST', '', path_params, {})

    if (response.error) {
      return response
    }

    return response as UnverifiedApiResult
  } catch (error: any) {
    return { error }
  }
}
