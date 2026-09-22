enum CookieKey {
  MEMBER_ID = "cookie-mumate-id",
  MEMBER_NAME = "cookie-mumate-name",
  MEMBER_SURNAME = "cookie-mumate-surname",
  MEMBER_IMAGE = "cookie-mumate-image",
  MEMBER_REFER_CODE = "cookie-mumate-refer",
  MEMBER_EMAIL = "cookie-mumate-email",
  // ผูก MEMBER_ID กับ "ตัวตน LINE/provider" (sub) ที่ mint มัน — กัน cookie member ค้างข้ามบัญชีใน jar เดียวกัน
  // (เอ็ม 2026-09-21). ⚠️ ห้ามบังคับ re-register ถ้าไม่มี cookie นี้ (บทเรียน revert #755/#760): ผู้ใช้เดิม
  // ที่ไม่มี MEMBER_SUB ให้ hydrate ปกติ + backfill เงียบ ๆ; re-register เฉพาะเมื่อ sub ไม่ตรงกันจริง.
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
