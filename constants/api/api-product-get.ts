import { callApi } from '../../utils/fetch'
import { API } from './endpoint'

export const ProductGet = async (page: string, element: string, percentage_love: any) => {
  try {
    const path_params = {
      page: page,
      element: element,
      percentage_love: percentage_love,
     }

    const response = await callApi(API.product.get, 'GET', '', path_params, {})

    if (response.error) {
      return response
    }

    return response
  } catch (error: any) {
    return { error }
  }
}
