import { callApi } from '../../utils/fetch'
import { API } from './endpoint'

export const AICardStreamingAPI = async (user_id: string, session_id: string, card_no: any, message: string) => {
  try {
    const path_params = {
      "card_no": card_no,
      "session_id": session_id,
      "user_id": user_id,
      "message": message
    }

    const response = await callApi(API.ai.card_streaming, 'POST', '', path_params, {})

    if (response.error) {
      return response
    }

    return response
  } catch (error: any) {
    return { error }
  }
}
