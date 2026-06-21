enum PageRouter {
  HOME = "/",
  WELCOME = "/welcome",
  RESULT = "/my-destiny",
  LOGIN = "/login",
  LOGIN_WITH = "/login",


  REGISTER = "/register",


  SURVEY = "/survey",

  SHARE_PROFILE = "/share/profile/:code",
  SHARE_TYPE = "/share/type/:code",

  LOVE_MATE = "/love-mate",
  WORK_VIBE = "/work-vibe",

  PROFILE = "/profile",
  PROFILE_EDIT = "/profile/edit",

  HOW_TO_EARN = "/profile/how-to-earn",
  LOG_ACTIVITY = "/profile/activity",


  FORTUNE_STICK = "/fortune-stick",
  PACKAGE_HOROSCOPE = "/package-horoscope",
  PACKAGE_PRICE = "/package-price",


  MATCHING = "/matching",
  MATCHING_RESULT = "/matching/result",
  MATCHING_RECENT = "/matching/recent",


  PAYMENT_FAMILY = "/payment/family-plan",
  PAYMENT_SELECT_CHANNEL = "/payment",
  PAYMENT_VIA_CREDIT_CARD = "/payment/creditcard",
  PAYMENT_VERIFY_OTP = "/payment/verify-otp",
  PAYMENT_VIA_QRCODE = "/payment/qrcode",
  PAYMENT_VIA_QRCODE_SCAN = "/payment/qrcode/scan",
  PAYMENT_TRANSFER = "/payment/transfer",
  PAYMENT_THANKYOU = "/payment/thankyou",
  PAYMENT_FAILURE = "/payment/failure",

  CHINESE_CALENDAR = "/chinese-calendar",

  FRIEND_PROFILE = "/friend/:friend_id",
  FRIEND_PROFILE_EDIT = "/friend/:friend_id/edit"
}

export { PageRouter };
