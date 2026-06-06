import { callApi } from '../../utils/fetch'
import { API } from './endpoint'
import { REQUEST_COMPATIBILITY_LOVE_GET } from './request-compatibility-love'
import { RESPONSE_COMPATIBILITY_LOVE_GET } from './response-compatibility-love'

export const CompatibilityWorkGet = async (
  user_id: string,
  me_name: string, me_dob: string, me_time: string, me_gender: string,
  name: string, dob: string, time: string, gender: string,
  type: string

) => {
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

    return response as RESPONSE_COMPATIBILITY_LOVE_GET
  } catch (error: any) {
    return { error }
  }
}
