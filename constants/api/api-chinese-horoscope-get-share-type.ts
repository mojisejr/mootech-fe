import { callApi } from '../../utils/fetch'
import { API } from './endpoint'

export const ChineseHoroscopeGetShareType = async (code: string) => {
  try {
    const path_params = {
      code: code,
    }

    const response = await callApi(API.survey.get_share_type, 'GET', '', path_params, {})
    if (response.error) {
      return response
    }

    return response
  } catch (error: any) {
    return { error }
  }
}
