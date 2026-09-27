import { callApi } from '../../utils/fetch'
import { LOCAL_API as API } from './endpoint-local' // not ./endpoint: keeps the retired BE entries out of v2's chunks (be-retirement 2b)

export const UserGetById = async (user_id: string) => {
  try {
    const path_params = {
      user_id: user_id,
    }

    const response = await callApi(API.user.get, 'GET', '', path_params, {})

    if (response.error) {
      return response
    }

    return response
  } catch (error: any) {
    return { error }
  }
}
