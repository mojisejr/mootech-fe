export interface REQUEST_OTP_GET {
  tel: string
}

export interface REQUEST_OTP_VERIFY {
  otp: string;
  ref_code: string;
}