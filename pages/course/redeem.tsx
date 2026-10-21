// /course/redeem?code=<โค้ด> — ลิงก์รับสิทธิ์คอร์สออนไลน์ที่แอดมินสร้างใน /ops (เอ็ม 2026-10-21)
// ล็อกอินแล้ว → กด "รับคอร์ส" → แลกโค้ด (คูปองชนิด course ที่ engine) → พาเข้าหน้าคอร์สที่ได้สิทธิ์
// ยังไม่ล็อกอิน → จำโค้ด → ไปล็อกอิน → กลับมาที่นี่เอง (pages/v2/index.tsx) · 1 บัญชีใช้โค้ดเดิมได้ครั้งเดียว
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import { SkyBackdrop, SkyHeader } from '@/features/v2-profile/components/kit'
import { useCurrentUser } from '@/lib/auth/use-current-user'
import { COURSE_REDEEM_KEY, REDEEM_CODE_RE } from '@/features/course/redeem'
import { CARD } from '@/features/course/EpisodeList'

type Phase = 'idle' | 'busy' | 'done' | 'error'

export default function CourseRedeemPage() {
  const router = useRouter()
  const { status } = useCurrentUser()
  const [code, setCode] = useState('')
  const [phase, setPhase] = useState<Phase>('idle')
  const [msg, setMsg] = useState<string | null>(null)
  const [dest, setDest] = useState<string>('/course/calendar')

  // โค้ดจากลิงก์ (?code=) หรือที่จำไว้ก่อนล็อกอิน
  useEffect(() => {
    if (!router.isReady) return
    const q = typeof router.query.code === 'string' ? router.query.code.trim() : ''
    let saved = ''
    try { saved = window.localStorage.getItem(COURSE_REDEEM_KEY) ?? '' } catch { /* storage ปิด */ }
    const c = REDEEM_CODE_RE.test(q) ? q : REDEEM_CODE_RE.test(saved) ? saved : ''
    setCode(c)
    if (c) { try { window.localStorage.setItem(COURSE_REDEEM_KEY, c) } catch { /* storage ปิด */ } }
  }, [router.isReady, router.query.code])

  const login = () => {
    try { window.localStorage.setItem(COURSE_REDEEM_KEY, code) } catch { /* storage ปิด */ }
    void router.push('/v2/login')
  }

  const redeem = async () => {
    setPhase('busy'); setMsg(null)
    try {
      const r = await fetch('/api/coupon-redeem', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code }) })
      const j = (await r.json().catch(() => ({}))) as { ok?: boolean; reward?: string; message?: string; reason?: string }
      try { window.localStorage.removeItem(COURSE_REDEEM_KEY) } catch { /* storage ปิด */ }
      // ใช้ไปแล้ว (ALREADY) แต่มีสิทธิ์อยู่ = ถือว่าสำเร็จ ให้เข้าเรียนได้เลย
      const [cal, mat] = await Promise.all(['calendar', 'life-matrix'].map((s) => fetch(`/api/course/${s}`).then((x) => (x.ok ? x.json() : null)).catch(() => null)))
      const to = cal?.access ? '/course/calendar' : mat?.access ? '/course/life-matrix' : null
      if (j.ok || (j.reason === 'ALREADY' && to)) {
        setDest(to ?? '/course/calendar'); setPhase('done'); setMsg(j.ok ? `ได้รับสิทธิ์ ${j.reward ?? 'คอร์ส'} แล้ว` : 'บัญชีนี้มีสิทธิ์คอร์สนี้อยู่แล้ว')
      } else {
        setPhase('error'); setMsg(j.message ?? 'ใช้โค้ดไม่สำเร็จ ลองตรวจโค้ดอีกครั้ง')
      }
    } catch {
      setPhase('error'); setMsg('เชื่อมต่อไม่สำเร็จ ลองใหม่อีกครั้ง')
    }
  }

  return (
    <div className="relative min-h-screen w-full overflow-x-hidden bg-white font-ibm">
      <Head><title>รับสิทธิ์คอร์ส · Mumate</title></Head>
      <SkyBackdrop />
      <SkyHeader title="รับสิทธิ์คอร์สเรียน" backHref="/course/calendar" testId="course-redeem" />
      <main className="relative z-10 mx-auto flex w-full max-w-md flex-col gap-4 px-4 pb-16 pt-3">
        <section className={CARD} data-testid="course-redeem-card">
          <p className="text-center text-4xl">🎓</p>
          <h1 className="mt-2 text-center text-lg font-black text-v3-navy">รับสิทธิ์เรียนคอร์ส Mumate</h1>
          <label className="mt-4 block text-xs font-bold text-v3-text-body">โค้ดรับคอร์ส</label>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.trim().toUpperCase())}
            data-testid="course-redeem-code"
            className="mt-1 w-full rounded-2xl border border-v3-border-card px-4 py-3 text-center text-base font-bold tracking-widest text-v3-navy outline-none focus:border-v3-sapphire"
            placeholder="เช่น WTD-ABC123"
          />
          {phase === 'done' ? (
            <>
              <p className="mt-4 text-center text-sm font-bold text-[#3E7E3A]" data-testid="course-redeem-ok">✅ {msg}</p>
              <Link href={dest} data-testid="course-redeem-go" className="mt-3 grid h-12 w-full place-items-center rounded-full bg-v3-sapphire text-base font-bold text-v3-lime">เข้าเรียนเลย</Link>
            </>
          ) : status === 'anon' ? (
            <button type="button" onClick={login} disabled={!REDEEM_CODE_RE.test(code)} data-testid="course-redeem-login" className="mt-4 grid h-12 w-full place-items-center rounded-full bg-v3-sapphire text-base font-bold text-v3-lime disabled:opacity-50">
              เข้าสู่ระบบเพื่อรับคอร์ส
            </button>
          ) : (
            <button type="button" onClick={() => void redeem()} disabled={status !== 'authed' || phase === 'busy' || !REDEEM_CODE_RE.test(code)} data-testid="course-redeem-btn" className="mt-4 grid h-12 w-full place-items-center rounded-full bg-v3-sapphire text-base font-bold text-v3-lime disabled:opacity-50">
              {phase === 'busy' ? 'กำลังรับสิทธิ์…' : 'รับคอร์ส'}
            </button>
          )}
          {phase === 'error' && <p className="mt-3 text-center text-sm font-bold text-v3-error" data-testid="course-redeem-error">{msg}</p>}
          <p className="mt-4 text-center text-xs leading-5 text-v3-text-muted">1 บัญชีใช้โค้ดเดิมได้ครั้งเดียว · ได้สิทธิ์แล้วเข้าเรียนได้ตลอด และดูได้ที่หน้าโปรไฟล์ › คอร์สของฉัน</p>
        </section>
      </main>
    </div>
  )
}
