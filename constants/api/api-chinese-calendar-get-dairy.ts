import { callApi } from '../../utils/fetch'
import { API } from './endpoint'

export const ChineseCalendarGetDairyAPI = async (
  user_id: string, 
  day: number, month: number, year: any) => {
  try {
    const path_params = {
      "user_id": user_id,
      "day": day,
      "month": month,
      "year": year
    }

    const response = await callApi(API.chinese_calendar.diary, 'GET', '', path_params, {})

    if (response.error) {
      return response
    }

    return response
  } catch (error: any) {
    return { error }
  }
}
