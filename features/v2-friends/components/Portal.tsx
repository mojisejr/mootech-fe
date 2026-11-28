// features/v2-friends/components/Portal.tsx — render overlay (ชีต/toast) ไปที่ <body> แทนที่จะอยู่ในคอลัมน์เนื้อหา
//
// 🔴 ทำไมต้องมี: SkyScreen ครอบเนื้อหาด้วย `relative z-10` — overlay ที่ render อยู่ข้างใน แม้เขียน z-50 ก็ถูกตีค่า
//    ภายในกล่อง z-10 แล้วแถบเมนูล่าง (z-40 ระดับราก) ทับปุ่มในชีต (เจอตอนไล่บนเบราว์เซอร์จริง: กด "ลบเพื่อน" ไม่ได้
//    เพราะแถบ "ปฏิทิน" ครอบจุดนั้นอยู่) ทางออกเดียวกับ ComingSoon/InstallGuideSheet คือ portal ไป body
// ใช้กับ overlay ที่โผล่หลังผู้ใช้แตะเท่านั้น (state เริ่ม null) ⇒ SSR ไม่เดินถึงนี่ จึงไม่มี hydration mismatch
import { createPortal } from "react-dom"
import type { ReactNode } from "react"

export function Portal({ children }: { children: ReactNode }) {
  if (typeof document === "undefined") return null
  return createPortal(children, document.body)
}
