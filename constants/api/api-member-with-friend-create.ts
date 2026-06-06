import { callApi } from '../../utils/fetch'
import { API } from './endpoint'

export const MemberWithFriendCreateApi = async (
  user_id: string, 
  dob: string, 
  name: string,
  surname: string,
  time: string,
  gender: string, 
  is_remember_time: boolean,
  picture_url: string,
) => {
  try {
    const path_params = {
      user_id: user_id,
      dob: dob,
      time: time,
      gender: gender,
      is_remember_time: is_remember_time,
      name: name,
      surname: surname,
      picture_url: picture_url,
    }

    const response = await callApi(API.member_with_friend.create, 'POST', '', path_params, {})

    if (response.error) {
      return response
    }

    return response
  } catch (error: any) {
    return { error }
  }
}
