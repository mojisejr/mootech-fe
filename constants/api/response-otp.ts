export interface RESPONSE_OTP_GET {
  tel: string
  ref_code: string
  expireAt: string
}

export interface RESPONSE_OTP_VERIFY {
  status: number;
}