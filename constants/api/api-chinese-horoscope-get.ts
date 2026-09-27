import { callApi } from '../../utils/fetch'
import { API } from './endpoint'
import { RESPONSE_CHINESE_HOROSCOPE_GET } from './response-chinese-horoscope'
import type { ChartPayload } from '@/lib/chart/engine-chart'

// GET /api/chinese-horoscope returns the chart ENVELOPED: `{ data: <chart> }`. The old flat
// `as RESPONSE_CHINESE_HOROSCOPE_GET` cast erased that `.data` hop from tsc, so a flat read
// (chart.detail / chart.summary.element) silently yielded `undefined` — the v2-home greeting ธาตุ element
// went missing (#167; toComputeSource now unwraps `.data` as defense). Fix: expose the `.data` hop AND type
// the inner chart from the REAL response verified LIVE (RESPONSE_CHINESE_HOROSCOPE_GET rewritten to the 15
// real keys — see that file). This is the one #167 site we can hit read-only; the others save/register/SMS
// so they get loose honest types (can't verify without side effects — #184). my-destiny now reads real fields.
// mumate-be-retirement-001 slice 1: the route now answers with the ENGINE-derived chart (ChartPayload —
// the legacy paths v2 reads, nothing else). The legacy-only keys (analytic, power, share_profile_url, …)
// are therefore absent at runtime; they stay in the type only as optional, for v1 /my-destiny, which is
// retired by slice 2 and already guards every one of them.
export type ChineseHoroscopeGetResult = {
  data?: (ChartPayload & Partial<Omit<RESPONSE_CHINESE_HOROSCOPE_GET, keyof ChartPayload>>) | null
  error?: unknown
}

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
