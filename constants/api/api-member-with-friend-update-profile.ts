import { callApi } from '../../utils/fetch'
import { API } from './endpoint'

export const MemberWithFriendUpdateProfileApi = async (
  friend_id: string, 
  dob: string, 
  name: string,
  surname: string,
  time: string,
  gender: string, 
  is_remember_time: boolean,
) => {
  try {
    const path_params = {
      friend_id: friend_id,
      dob: dob,
      time: time,
      gender: gender,
      is_remember_time: is_remember_time,
      name: name,
      surname: surname,
    }

    const response = await callApi(API.member_with_friend.update_profile, 'PUT', '', path_params, {})

    if (response.error) {
      return response
    }

    return response
  } catch (error: any) {
    return { error }
  }
}
