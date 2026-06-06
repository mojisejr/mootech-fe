import { callApi } from '../../utils/fetch'
import { API } from './endpoint'

export const ChineseCalendarGetMonthAPI = async (
  user_id: string, 
  month: number, year: number) => {
  try {
    const path_params = {
      "user_id": user_id,
      "month": month,
      "year": year
    }

    const response = await callApi(API.chinese_calendar.month, 'GET', '', path_params, {})

    if (response.error) {
      return response
    }

    return response
  } catch (error: any) {
    return { error }
  }
}
