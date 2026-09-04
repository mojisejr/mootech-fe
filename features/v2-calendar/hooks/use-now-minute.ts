// features/v2-calendar/hooks/use-now-minute.ts — นาฬิกาที่เดินต่อให้จอปฏิทิน (#586).
//
// ปัญหาที่โค้ดเดิมเป็น: `[date].tsx` คำนวณ `const now = new Date()` **ตอน render เดียว** — ถ้าผู้ใช้
// เปิดหน้าทิ้งไว้ข้ามช่วงเวลา (PWA ค้างหน้าจอเป็นเรื่องปกติ) สถานะปุ่มยามทั้งแถวค้างตาม `now` ใบเก่า:
// ยามที่ "ยังไม่ถึง" ตอน render ยังโชว์ว่ากดได้ ทั้งที่เลยเวลาไปแล้ว (และ ยามเพิ่มแล้ว ก็ไม่เดินเป็น past)
//
// ทางแกอ่านนาฬิกาใหม่ทุก 30 วินาที + ทุกครั้งที่แท็บกลับมาโชว์ (visibilitychange) — เพราะเบราว์เซอร์
// หยุด interval ของแท็บหลัง และการกลับมาดูคือจังหวะที่ผู้ใช้กำลังจะอ่านปุ่ม
//
// 🔴 อย่าใช้ตัวนี้แทน `now` ที่ฉีดเข้าฟัน — ฟันของ "เลยเวลา" ยังยิงที่ yamReminderStatus/dayReminderCta
// ด้วยเวลาที่ป้อนเองเหมือนเดิม (ดู comment ที่ [date].tsx); ตัวนี้มีไว้ให้จอ "สด" ไม่ใช่ให้เทสต์ใช้
import { useEffect, useState } from 'react'

export function useNowMinute(intervalMs = 30_000): Date {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const tick = () => setNow(new Date())
    const id = setInterval(tick, intervalMs)
    document.addEventListener('visibilitychange', tick)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [intervalMs])

  return now
}
