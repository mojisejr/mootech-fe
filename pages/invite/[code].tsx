// pages/invite/[code].tsx — จุดรับ deep link ชวนเพื่อน (team.mp4: ลิงก์กลาง mumate.com/invite/MUMATE123).
//
// 🔴 ต้องเป็น client component ที่เก็บโค้ดลง localStorage ก่อนพาไปหน้าสมัคร: ผู้ใช้ใหม่ส่วนใหญ่ยังไม่ล็อกอิน
// และหน้า /v2/register จะเด้งกลับ /v2 จนกว่าจะล็อกอิน (useV2AuthGate) — ถ้าพาโค้ดไปแค่ผ่าน ?ref= อย่างเดียว
// มันจะหลุดหายในรอบล็อกอิน; localStorage ทำให้โค้ดรออยู่จนกว่าจะไปถึงหน้าสมัครจริง
//
// โค้ดผิดรูปแบบ → ส่งเข้าหน้าสมัครแบบไม่เติม (ช่องว่าง = ผู้ใช้พิมพ์เอง); การปฏิเสธโค้ดเกิดตอน submit
// โดย useReferralApply/BFF — ลิงก์เพื่อนเน่า ❌ ไม่มีทางทำให้การสมัครพัง
import { useRouter } from 'next/router'
import { useEffect } from 'react'

export const REFERRAL_STORAGE_KEY = 'v2:referral'

export default function InvitePage() {
  const router = useRouter()
  const { code } = router.query

  useEffect(() => {
    if (!code) return // router ยัง hydrate ไม่เสร็จ
    const v = Array.isArray(code) ? code[0] : code
    if (v && /^[A-Za-z0-9]{4,32}$/.test(v)) {
      window.localStorage.setItem(REFERRAL_STORAGE_KEY, v)
      router.replace(`/v2/register?ref=${encodeURIComponent(v)}`)
      return
    }
    router.replace('/v2/register')
  }, [code, router])

  return null // redirect เสมอ — ไม่มีหน้าวาด
}
