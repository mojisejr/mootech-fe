import { callApi } from '../../utils/fetch'
import { API } from './endpoint'
export const SurveyCalculate = async (user_id: string, answer: any[]) => {
  try {
    const path_params = {
      user_id: user_id,
      choices: answer
    }

    const response = await callApi(API.survey.calculate, 'POST', '', path_params, {})

    if (response.error) {
      return response
    }

    return response
  } catch (error: any) {
    return { error }
  }
}
