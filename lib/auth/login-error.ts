// mumate-login-identity slice 7b (2026-10-01): OAuth ที่พลาดทุกแบบ (state cookie หาย / state ไม่ตรง / code ใช้ไม่ได้)
// ถูก next-auth เด้งกลับ pages.signIn = /v2/login?error=<code> — แต่หน้า login ไม่เคยอ่าน error เลย ผู้ใช้จึงเห็นแค่
// "กดแล้วกลับมาหน้าเดิม" = login loop ที่ไม่มีใครบอกอะไร (จำลองบน staging 2026-10-01: callback ที่ไปตกอีก cookie jar →
// /api/auth/error → /api/auth/signin → /v2/login?error=OAuthCallback). ไฟล์นี้แปลง code เป็นข้อความที่บอกทางไปต่อ.

// in-app browser ของ Facebook / Messenger / Instagram (Android: FB_IAB/FBAV, iOS: FBAN/FBAV, IG: Instagram).
// ในนี้ LINE auto login บน Android สลับไปแอป LINE แล้ว callback กลับมาอีกเบราว์เซอร์ → state cookie หาย.
export function isSocialInAppBrowser(userAgent: string): boolean {
  return /\b(FBAN|FBAV|FB_IAB|FB4A|MESSENGER|Instagram)\b/i.test(userAgent)
}

const OPEN_IN_BROWSER_HINT =
  'ถ้าเปิดลิงก์จาก Facebook หรือ Instagram ให้กดปุ่ม ⋯ มุมขวาบน แล้วเลือก "เปิดในเบราว์เซอร์" ก่อนเข้าสู่ระบบค่ะ'

// code ที่ next-auth ส่งมากับ pages.signIn (core/index.js + core/routes/callback.js).
const RETRY_CODES = new Set(['OAuthCallback', 'OAuthSignin', 'Callback', 'OAuthCreateAccount', 'SessionRequired'])

export function loginErrorNotice(error: unknown, userAgent: string): string | null {
  const code = Array.isArray(error) ? error[0] : error
  if (typeof code !== 'string' || code === '') return null

  if (code === 'AccessDenied') {
    return 'การเข้าสู่ระบบถูกยกเลิก ลองกดอีกครั้งแล้วกด "อนุญาต" นะคะ'
  }

  const base = RETRY_CODES.has(code)
    ? 'เข้าสู่ระบบไม่สำเร็จ ลองกดอีกครั้งนะคะ'
    : 'เข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่อีกครั้งค่ะ'
  return isSocialInAppBrowser(userAgent) ? `${base} ${OPEN_IN_BROWSER_HINT}` : base
}
