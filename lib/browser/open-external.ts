// เปิด url ใน "เบราว์เซอร์จริง" (Chrome/Safari) — ใช้ตอนล็อกอิน (slice 7c), ติดตั้ง PWA, เปิดแจ้งเตือน, ลิงก์ภายนอก.
// การตัดสินใจอยู่ใน lib/browser/in-app.ts (pure); ไฟล์นี้แค่ลงมือ.
// 🔴 เรียกตรงจาก click handler: นอก LINE ไม่มี await ก่อน window.open (ของเดิม await LIFF init ก่อน → ป๊อปอัปโดนบล็อก).
import { externalNavigation, inAppBrowserKind, isSocialInAppBrowser as isSocialUA } from './in-app'

function ua(): string {
  return typeof navigator === 'undefined' ? '' : navigator.userAgent
}

export function isLineInAppBrowser(): boolean {
  return inAppBrowserKind(ua()) === 'line'
}

export function isSocialInAppBrowser(): boolean {
  return isSocialUA(ua())
}

/** อยู่ใน in-app browser ใดๆ (LINE / Facebook / Instagram) */
export function isInAppBrowser(): boolean {
  return inAppBrowserKind(ua()) !== null
}

export async function openInExternalBrowser(url: string): Promise<void> {
  if (typeof window === 'undefined') return
  const nav = externalNavigation(url, ua())
  if (nav.via === 'href') {
    window.location.href = nav.url
    return
  }
  if (nav.via === 'line') {
    // LIFF SDK โหลดเฉพาะตอนนี้ (ไม่ boot ทุกหน้าแล้ว) — ใน LIFF browser เท่านั้นที่ต้องใช้ openWindow
    try {
      const { getLiff } = await import('@/lib/line/liff')
      const liff = await getLiff()
      if (liff.isInClient()) {
        liff.openWindow({ url: nav.liffUrl, external: true })
        return
      }
    } catch {
      /* LIFF ใช้ไม่ได้ → in-app browser ธรรมดาของ LINE */
    }
    window.location.href = nav.hrefUrl
    return
  }
  window.open(nav.url, '_blank', 'noopener')
}
