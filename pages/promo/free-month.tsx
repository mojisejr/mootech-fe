// /promo/free-month?code=XXXX — เพื่อนกดรับ Mumate Pro ฟรี 1 เดือน (Promo B).
// ต้องล็อกอินก่อน (grant ผูก user_id). กด "รับสิทธิ์" → POST /api/v2/promo/redeem → โชว์ผล.
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useState } from 'react'

import { KitButton } from '@/features/v2-profile/components/kit'
import { useCurrentUser } from '@/lib/auth/use-current-user'

const REASON_TEXT: Record<string, string> = {
  DISABLED: 'แคมเปญนี้ปิดรับสิทธิ์แล้ว',
  INVALID: 'โค้ดไม่ถูกต้องหรือไม่มีอยู่',
  SELF: 'ใช้โค้ดของตัวเองไม่ได้',
  ALREADY: 'คุณเคยรับสิทธิ์ฟรีนี้ไปแล้ว',
  ISSUER_FULL: 'โค้ดนี้มีผู้รับครบ 10 คนแล้ว',
  CAMPAIGN_FULL: 'สิทธิ์ฟรีของแคมเปญนี้หมดแล้ว',
}

export default function PromoFreeMonthPage() {
  const router = useRouter()
  const code = typeof router.query.code === 'string' ? router.query.code : ''
  const { status } = useCurrentUser()
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const redeem = async () => {
    if (!code) { setErr('ไม่พบโค้ดในลิงก์'); return }
    setBusy(true); setErr(null)
    try {
      const r = await fetch('/api/v2/promo/redeem', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code }),
      })
      const j = (await r.json().catch(() => ({}))) as { ok?: boolean; reason?: string }
      if (r.ok && j.ok) { setDone(true); return }
      setErr(REASON_TEXT[String(j.reason)] ?? 'รับสิทธิ์ไม่สำเร็จ ลองใหม่อีกครั้ง')
    } catch {
      setErr('เชื่อมต่อไม่สำเร็จ ลองใหม่อีกครั้ง')
    } finally { setBusy(false) }
  }

  return (
    <div className="font-ibm min-h-[100dvh] w-full bg-v3-ghost-white">
      <Head><title>รับ Mumate Pro ฟรี 1 เดือน · MuMate</title></Head>
      <div className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col items-center justify-center gap-5 px-6 text-center">
        <p className="text-2xl font-black text-v3-sapphire">🎁 Mumate Pro ฟรี 1 เดือน</p>
        <p className="text-sm leading-[22px] text-v3-text-body">
          เพื่อนแชร์สิทธิ์พิเศษให้คุณ — กดรับเพื่อใช้ <b className="text-v3-navy">Mumate Pro ฟรี 30 วัน</b>
        </p>
        {code ? <p className="rounded-full bg-white px-4 py-2 text-base font-black tracking-wider text-v3-navy v3-shadow-card">{code}</p> : null}

        {done ? (
          <div className="flex w-full flex-col items-center gap-4">
            <p className="text-lg font-bold text-v3-cyan">✅ รับสิทธิ์สำเร็จ! ใช้ Mumate Pro ได้เลย</p>
            <KitButton href="/v2" testId="promo-free-home" className="!h-[52px]">เริ่มใช้งาน</KitButton>
          </div>
        ) : status === 'anon' ? (
          <div className="flex w-full flex-col items-center gap-3">
            <p className="text-sm text-v3-text-muted">เข้าสู่ระบบก่อนเพื่อรับสิทธิ์</p>
            <KitButton href={`/v2/login?next=${encodeURIComponent(`/promo/free-month?code=${code}`)}`} testId="promo-free-login" className="!h-[52px]">
              เข้าสู่ระบบ / สมัคร
            </KitButton>
          </div>
        ) : (
          <div className="flex w-full flex-col items-center gap-3">
            <button
              type="button"
              onClick={() => void redeem()}
              disabled={busy || !code}
              data-testid="promo-free-redeem"
              className="grid h-[52px] w-full max-w-xs place-items-center rounded-full bg-v3-lime text-[16px] font-black text-v3-sapphire disabled:opacity-50"
            >
              {busy ? 'กำลังรับสิทธิ์…' : 'รับ Pro ฟรี 1 เดือน'}
            </button>
            {err ? <p className="text-[13px] font-bold text-v3-error" data-testid="promo-free-err">{err}</p> : null}
            <Link href="/v2" className="text-[13px] text-v3-text-muted underline">ไว้ทีหลัง</Link>
          </div>
        )}
      </div>
    </div>
  )
}
