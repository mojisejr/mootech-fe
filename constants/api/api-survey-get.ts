import { callApi } from '../../utils/fetch'
import { API } from './endpoint'
export const SurveyGet = async () => {
  try {
    const path_params = { }

    const response = await callApi(API.survey.get, 'GET', '', path_params, {})

    if (response.error) {
      return response
    }

    return response
  } catch (error: any) {
    return { error }
  }
}
