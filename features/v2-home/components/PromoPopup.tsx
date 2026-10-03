// features/v2-home/components/PromoPopup.tsx — ป็อปอัปหน้าแรก: โปรฯ "เช็กอินรับ Qi" อย่างเดียว (เอ็ม 2026-09-23).
// (โปรฯ อื่นย้ายไป carousel ในหน้าหลักแล้ว — features/v2-home/components/PromoCarousel.tsx)
//
// พฤติกรรม:
//   • เฉพาะสมาชิกที่ล็อกอินแล้ว (useCurrentUser = 'authed') และยังไม่เช็กอินวันนี้ (mumate-promo-popup-auth-001):
//     'anon' ไม่เด้ง, 'loading' รอ (คนที่กลับจาก LINE ค้าง 'loading' ได้ ~17 วิ ระหว่าง mint identity).
//     เช็กใหม่ทุกครั้งที่ status/path เปลี่ยน — /v2/login ส่งสมาชิกไป /v2 ด้วย router.replace (ไม่ remount).
//     อ่าน /api/qi-wallet ครั้งเดียว: เช็กอินวันนี้แล้ว = ไม่เด้ง; อ่านไม่ได้ = เด้ง (แย่สุด = พฤติกรรมเดิม)
//   • เด้งครั้งเดียวต่อ session ในหน้า /v2 แรกที่เข้าเงื่อนไข (ยกเว้นหน้า login/สมัคร/หาธาตุแท้)
//   • ปิด (X / แตะพื้นหลัง) = ปิดรอบนี้ (ไม่เด้งซ้ำใน session นี้)
//   • "ไม่แสดง 7 วัน" = จำใน localStorage 7 วัน
//   • แตะรูป = ไปหน้าเช็กอิน
import { useEffect, useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/router'
import { useCurrentUser } from '@/lib/auth/use-current-user'
import { checkedInToday, todayBangkok, type Wallet } from '@/features/v2-qi/qi-model'

const CHECKIN = { src: '/images/v2/popup/checkin.png', href: '/v2/qi/checkin', alt: 'เช็กอินทุกวัน รับ Qi ฟรี' }
const HIDE_KEY = 'mumate:promo-hidden-until' // localStorage: timestamp ที่ให้กลับมาแสดงได้ (ไม่แสดง 7 วัน)
const SHOWN_KEY = 'mumate:promo-shown' // sessionStorage: ตัดสินแล้วรอบนี้ — เด้งไปแล้ว หรือเช็กอินแล้ว (กันอ่าน wallet/เด้งซ้ำทุกครั้งที่เปลี่ยนหน้า)
const HIDE_DAYS = 7

// ไม่เด้งบนหน้าที่ไม่ใช่แอปหลัก + หน้าหาธาตุแท้ (เอ็ม: ไม่เอา popup ในหน้านี้)
const EXCLUDE = ['/v2/login', '/v2/register', '/v2/onboarding', '/v2/first-run', '/v2/first-run-preview', '/v2/element-finder']
function isPromoPath(path: string): boolean {
  if (!(path === '/v2' || path.startsWith('/v2/'))) return false
  return !EXCLUDE.some((p) => path === p || path.startsWith(`${p}/`))
}

function hiddenNow(): boolean {
  try {
    const until = Number(window.localStorage.getItem(HIDE_KEY))
    return Number.isFinite(until) && until > Date.now()
  } catch { return false }
}
function shownThisSession(): boolean {
  try { return window.sessionStorage.getItem(SHOWN_KEY) === '1' } catch { return false }
}

// อ่านไม่ได้ (เครือข่าย/5xx/รูปร่างผิด) = false → เด้ง
async function alreadyCheckedInToday(): Promise<boolean> {
  try {
    const res = await fetch('/api/qi-wallet')
    if (!res.ok) return false
    const wallet = (await res.json()) as Wallet
    return checkedInToday(wallet?.history, todayBangkok())
  } catch { return false }
}

export function PromoPopup() {
  const router = useRouter()
  const { status } = useCurrentUser()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (status !== 'authed') return
    if (!isPromoPath(router.pathname)) return
    if (hiddenNow() || shownThisSession()) return
    let alive = true
    const delay = new Promise((resolve) => setTimeout(resolve, 1200))
    void Promise.all([alreadyCheckedInToday(), delay]).then(([done]) => {
      if (!alive) return
      try { window.sessionStorage.setItem(SHOWN_KEY, '1') } catch { /* private mode */ }
      if (!done) setOpen(true)
    })
    return () => { alive = false }
  }, [status, router.pathname])

  const close = () => setOpen(false)
  const hide7d = () => {
    try { window.localStorage.setItem(HIDE_KEY, String(Date.now() + HIDE_DAYS * 24 * 60 * 60 * 1000)) } catch { /* private mode */ }
    setOpen(false)
  }
  const go = () => { setOpen(false); void router.push(CHECKIN.href) }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[75] flex items-center justify-center bg-black/50 px-8" onClick={close} data-testid="promo-popup-scrim">
      <div className="relative w-full max-w-[340px]" onClick={(e) => e.stopPropagation()}>
        <button type="button" onClick={go} data-testid="promo-popup-image" aria-label={CHECKIN.alt}
          className="block w-full overflow-hidden rounded-[24px] shadow-[0_12px_40px_rgba(0,0,0,0.35)]">
          <Image src={CHECKIN.src} alt={CHECKIN.alt} width={1000} height={1300} priority className="h-auto w-full object-contain" />
        </button>

        <button type="button" onClick={close} aria-label="ปิด" data-testid="promo-popup-close"
          className="absolute -top-3 -right-3 grid size-9 place-items-center rounded-full bg-white text-v3-navy shadow-lg">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="m6 6 12 12M18 6 6 18" /></svg>
        </button>

        <button type="button" onClick={hide7d} data-testid="promo-popup-hide"
          className="mt-2 block w-full text-center text-[12px] font-medium text-white/80 underline">
          ไม่แสดงอีกใน 7 วัน
        </button>
      </div>
    </div>
  )
}
