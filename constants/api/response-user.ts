export interface RESPONSE_USER_REGISTER_TEL {
  user_id: string
  name: string
  surname: string
  refer_code: string
}


export interface RESPONSE_USER_CHECK_LINE {
  is_user_new: boolean
  is_email: boolean
  is_info: boolean
}