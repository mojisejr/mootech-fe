// mumate-login-identity slice 7c (2026-10-01/02): ทุกการล็อกอินต้องจบใน "เบราว์เซอร์จริง" (Chrome/Safari) — ที่นั่น
// ติดตั้ง PWA + เปิดแจ้งเตือนได้ และ LINE/Google ล็อกอินได้ลื่น. in-app browser ของแอปอื่นทำไม่ได้:
//   - Facebook/Instagram (walk 2026-10-02, Android): LINE ไม่ auto login — ต้องกรอกอีเมล/รหัสผ่าน + รหัสยืนยันในแอป LINE
//   - Google บล็อก OAuth ใน webview ทุกตัว (disallowed_useragent, นโยบายถาวรของ Google)
// ไฟล์นี้ = การตัดสินใจล้วน (pure, เทสต์ได้): เป็น in-app ของใคร และจะพาออกไปเบราว์เซอร์จริงด้วย URL อะไร.

export type InAppKind = 'line' | 'facebook' | 'instagram'

/** in-app browser ของแอปไหน (จาก User-Agent) — null = เบราว์เซอร์จริง/ไม่รู้จัก */
export function inAppBrowserKind(userAgent: string): InAppKind | null {
  if (/\bLine\//i.test(userAgent)) return 'line'
  if (/\bInstagram\b/i.test(userAgent)) return 'instagram'
  // Android: [FB_IAB/FB4A;FBAV/...] · iOS: [FBAN/FBIOS;FBAV/...] · Messenger: FBAN/MessengerForiOS, FB_IAB/Orca-Android
  if (/\b(FBAN|FBAV|FB_IAB|FB4A|FBIOS|MESSENGER)\b/i.test(userAgent)) return 'facebook'
  return null
}

export function isLineInAppBrowser(userAgent: string): boolean {
  return inAppBrowserKind(userAgent) === 'line'
}

/** Facebook / Messenger / Instagram — พาออกก่อนเริ่ม OAuth (LINE มีทางของตัวเองข้างล่าง) */
export function isSocialInAppBrowser(userAgent: string): boolean {
  const kind = inAppBrowserKind(userAgent)
  return kind === 'facebook' || kind === 'instagram'
}

export function isAndroid(userAgent: string): boolean {
  return /\bAndroid\b/i.test(userAgent)
}

export function isIOS(userAgent: string): boolean {
  return /\b(iPhone|iPad|iPod)\b/i.test(userAgent)
}

export function withQueryParam(url: string, key: string, value: string): string {
  const u = new URL(url)
  u.searchParams.set(key, value)
  return u.toString()
}

// Android: intent:// เปิด Chrome ตรง (FB/IG webview ส่งต่อ intent ให้ระบบ). ไม่มี Chrome → browser_fallback_url.
export function chromeIntentUrl(url: string): string {
  const u = new URL(url)
  const target = `${u.host}${u.pathname}${u.search}`
  return `intent://${target}#Intent;scheme=${u.protocol.replace(':', '')};package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(url)};end`
}

export type ExternalNavigation =
  | { via: 'href'; url: string } // เปลี่ยนหน้าในแท็บเดิม → แอปเปิดเบราว์เซอร์ภายนอกให้
  // ใน LINE: LIFF browser (เปิดผ่าน https://liff.line.me/<id> เช่น rich menu) ไม่สน openExternalBrowser=1 (LINE docs:
  // ใช้ได้ทุก URL "ยกเว้น LIFF") → ต้อง liff.openWindow({external:true}); in-app browser ธรรมดาของ LINE ใช้ query ได้.
  // ตัดสินด้วย liff.isInClient() ตอนกด (UA แยกสองแบบนี้ไม่ได้แน่นอน) → ส่งทั้งสอง url ให้ตัวเรียก.
  | { via: 'line'; liffUrl: string; hrefUrl: string }
  | { via: 'window'; url: string } // เบราว์เซอร์จริงอยู่แล้ว → window.open ปกติ

/** จะพา url ออกไปเบราว์เซอร์จริงอย่างไร จาก UA ปัจจุบัน */
export function externalNavigation(url: string, userAgent: string): ExternalNavigation {
  const kind = inAppBrowserKind(userAgent)
  if (kind === 'line') {
    return { via: 'line', liffUrl: url, hrefUrl: withQueryParam(url, 'openExternalBrowser', '1') }
  }
  if (kind === 'facebook' || kind === 'instagram') {
    if (isAndroid(userAgent)) return { via: 'href', url: chromeIntentUrl(url) }
    // iOS: ไม่มีทางที่ทางการรับรอง. x-safari-https:// เปิด Safari ได้ในหลายเวอร์ชัน (ยังไม่ยืนยันบนเครื่อง) —
    // หน้าจอ OpenInBrowserScreen จึงมีวิธีกด ⋯ → "เปิดในเบราว์เซอร์" และปุ่มคัดลอกลิงก์สำรองไว้เสมอ.
    if (isIOS(userAgent)) return { via: 'href', url: `x-safari-${url}` }
  }
  return { via: 'window', url }
}
