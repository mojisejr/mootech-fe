import { callApi } from '../../utils/fetch'
import { API } from './endpoint'
import { RESPONSE_CHINESE_HOROSCOPE_GET } from './response-chinese-horoscope'

// The /api/chinese-horoscope route returns the chart ENVELOPED: `{ data: <chart> }`. The old
// `as RESPONSE_CHINESE_HOROSCOPE_GET` cast erased that `.data` hop from tsc, so reading a flat field
// (chart.detail / chart.summary.element) silently yielded `undefined` — the v2-home greeting ธาตุ element
// went missing (#167; toComputeSource now unwraps `.data` as defense). Fix (Zone-1 scope): make the `.data`
// hop VISIBLE so a flat read (`chart.summary`) no longer type-checks. `data` stays loose here on purpose —
// tightening the inner shape to RESPONSE_CHINESE_HOROSCOPE_GET is deferred with the other 7 `as RESPONSE_*`
// sites (it breaks pages/my-destiny, which reads power/analytic.life/share_profile_url not on that type).
// The Zone-1 consumer (useV2Home → toComputeSource) reads it as `unknown` and unwraps `.data` itself.
export type ChineseHoroscopeGetResult = { data?: any; error?: unknown }

export const ChineseHoroscopeGet = async (userId: string, code: string): Promise<ChineseHoroscopeGetResult> => {
  try {
    const path_params = {
      userId: userId,
      code: code,
    }

    const response = await callApi(API.chinese_horoscope.get, 'GET', '', path_params, {})
    if (response.error) {
      return { error: response.error }
    }

    return response as ChineseHoroscopeGetResult
  } catch (error: any) {
    return { error }
  }
}
