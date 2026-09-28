// components/post-login-return.tsx — เด้งกลับหน้าเดิมหลังล็อกอิน (เช่นหน้า checkout ที่มีโค้ดโปรฯ).
//
// 🔴 ทำไมไม่ใช้ OAuth callbackUrl: การยัด URL checkout (ที่มี ?code=) เป็น callbackUrl ทำ LINE login ค้าง
// (เอ็มพบ 2026-09-28). วิธีนี้แยกจาก OAuth ทั้งหมด — จำ path ไว้ใน sessionStorage ตอนถูกเด้งไป login แล้ว
// พอกลับมา authed ค่อยเด้งกลับ path นั้น (แค่ internal path ที่ปลอดภัย, ใช้ครั้งเดียวแล้วลบ).
import { useEffect, useRef } from 'react'
import { useRouter } from 'next/router'
import { useCurrentUser } from '@/lib/auth/use-current-user'

export const POST_LOGIN_RETURN_KEY = 'v2:post-login-return'

export default function PostLoginReturn() {
  const { status } = useCurrentUser()
  const router = useRouter()
  const done = useRef(false)

  useEffect(() => {
    if (done.current || status !== 'authed') return
    let target: string | null = null
    try { target = sessionStorage.getItem(POST_LOGIN_RETURN_KEY) } catch { /* ignore */ }
    if (!target) return
    done.current = true
    try { sessionStorage.removeItem(POST_LOGIN_RETURN_KEY) } catch { /* ignore */ }
    // safe internal path เท่านั้น (กัน open-redirect) + ไม่เด้งถ้าอยู่ที่นั่นแล้ว
    if (!target.startsWith('/') || target.startsWith('//') || target.includes('://') || target.includes('\\')) return
    if (router.asPath === target) return
    void router.replace(target)
  }, [status, router])

  return null
}
