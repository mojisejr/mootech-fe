import { callApi } from '../../utils/fetch'
import { API } from './endpoint'

export const AIGeneralAPI = async (user_id: string, message: string, category: string, 
  conversation_id: string) => {
  try {
    const path_params = {
      "user_id": user_id,
      "message": message,
      "category": category,
      conversation_id: conversation_id,
    }

    const response = await callApi(API.ai.general, 'POST', '', path_params, {})

    if (response.error) {
      return response
    }

    return response
  } catch (error: any) {
    return { error }
  }
}
