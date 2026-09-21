enum CookieKey {
  MEMBER_ID = "cookie-mumate-id",
  MEMBER_NAME = "cookie-mumate-name",
  MEMBER_SURNAME = "cookie-mumate-surname",
  MEMBER_IMAGE = "cookie-mumate-image",
  MEMBER_REFER_CODE = "cookie-mumate-refer",
  MEMBER_EMAIL = "cookie-mumate-email",
  // ผูก MEMBER_ID กับ "ตัวตน LINE/provider" (sub) ที่ mint มันขึ้นมา — กัน cookie member ค้างจาก
  // login เก่าใน jar เดียวกัน (LINE webview vs Chrome/PWA คนละ jar) ถูกเชื่อทั้งที่ session เป็นคนละ sub
  // (เอ็ม 2026-09-21: LINE บัญชีเดียวกันแต่ 2 ทางเข้าโชว์คนละ QI). mismatch/ไม่มี → re-register ผูกใหม่
  MEMBER_SUB = "cookie-mumate-sub",


  REFCODE_FGF = "cookie-mumate-fgf-code",
  LOGIN_PROVIDER = "cookie-mumate-provider-login",


  PAYMENT_PLAN = "cookie-mumate-payment-plan",
  PAYMENT_PACKAGE = "cookie-mumate-payment-package",
  PAYMENT_PACKAGE_NAME = "cookie-mumate-payment-name",
  PAYMENT_AMOUNT = "cookie-mumate-payment-amount",
  PAYMENT_EMAIL = "cookie-mumate-payment-email",


  MATCHING_ID = "cookie-mumate-matching-id",
}

export { CookieKey };
