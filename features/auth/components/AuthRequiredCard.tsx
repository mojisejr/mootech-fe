// features/auth/components/AuthRequiredCard.tsx
// เอ็ม 2026-09-20: ฟีเจอร์ที่ต้องกดใช้งาน (เสี่ยงทาย/เปิดไพ่/ดูดวงคู่รัก ฯลฯ) ตอนยังไม่ login เดิมแต่ละหน้า
// จัดการเองคนละแบบ — บางหน้าปล่อยให้ fetch ไป 401 แล้วโชว์ error ทั่วไป ("เสี่ยงทายไม่สำเร็จ ลองใหม่อีกครั้ง"),
// บางหน้า (compatibility) แค่ resolve เป็น null เงียบๆ ไม่มี error เลย — ผู้ใช้งงว่าเกิดอะไรขึ้น
// ต้นแบบที่ถูกต้องอยู่แล้วคือ ChatScreen.tsx guard==="not_authenticated" — ดึงออกมาเป็น component ใช้ร่วมกัน
// ให้ทุกฟีเจอร์ที่ต้อง login ก่อนกดใช้ พาไปหน้า /v2/login แบบเดียวกันหมด (แทนที่จะ error ทั่วไป/เงียบ)
import Link from "next/link"

export function AuthRequiredCard({
  message = "ลองเข้าสู่ระบบอีกครั้งเพื่อใช้งานฟีเจอร์นี้",
  testId = "auth-required-card",
}: {
  message?: string
  testId?: string
}) {
  return (
    <div data-testid={testId} className="w-full rounded-[18px] bg-white p-4 text-center shadow-[0_2px_10px_rgba(26,38,77,0.10)]">
      <p className="text-[13px] font-bold leading-5 text-v3-navy">ไม่พบข้อมูลผู้ใช้</p>
      <p className="mt-1 text-[12px] leading-4 text-v3-text-body">{message}</p>
      <Link
        href="/v2/login"
        className="mt-3 grid h-11 w-full place-items-center rounded-full bg-v3-cyan text-sm font-bold text-white"
      >
        เข้าสู่ระบบ
      </Link>
    </div>
  )
}
