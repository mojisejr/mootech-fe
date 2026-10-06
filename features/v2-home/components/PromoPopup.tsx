// features/v2-home/components/PromoPopup.tsx — ป็อปอัปหน้าแรก: โปรฯ "เช็กอินรับ Qi" อย่างเดียว (เอ็ม 2026-09-23).
// (โปรฯ อื่นย้ายไป carousel ในหน้าหลักแล้ว — features/v2-home/components/PromoCarousel.tsx)
//
// ประกาศปิดปรับปรุง (mumate-maintenance-notice-001, 2026-10-06): ก่อน NOTICE.until ป็อปอัปนี้แสดง "ประกาศแจ้ง
// ปิดปรับปรุงระบบ" แทนโปรฯ เช็กอิน — ให้ทุกคนเห็น (ล็อกอินหรือยังก็ได้), ไม่อ่าน wallet, แตะรูป = ปิด (ไม่พาไปไหน),
// "รับทราบ" = ไม่เด้งอีกจนหมดประกาศ. ตั้งแต่ NOTICE.until (เริ่มรอบย้าย server) กลับเป็นโปรฯ เช็กอินตามเดิมเอง —
// ไม่ต้อง deploy ซ้ำ (SHA เดียวกันรันทั้งบน Vercel ก่อนย้ายและบน DigitalOcean หลังย้าย).
// เลื่อนรอบย้าย = แก้ until + รูป แล้ว release ใหม่.
//
// พฤติกรรมโปรฯ เช็กอิน:
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

// รูปจากทีม (1040x1300) — ข้อความอยู่ในรูป จึงใส่ครบใน alt ให้ screen reader อ่านได้
export const NOTICE = {
  src: '/images/v2/popup/maintenance-20261009.png',
  alt: 'ประกาศแจ้ง Mumate ปิดปรับปรุงระบบชั่วคราว วันศุกร์ที่ 9 ตุลาคม 2569 เวลา 04.00-10.00 น. ไม่สามารถใช้งานได้ ขออภัยในความไม่สะดวก',
  width: 1040,
  height: 1300,
  until: Date.parse('2026-10-09T04:00:00+07:00'), // เริ่มรอบย้าย: หลังจากนี้ทุกคนเห็นหน้า maintenance อยู่แล้ว
}
const NOTICE_HIDE_KEY = 'mumate:notice-20261009-hidden' // localStorage: กด "รับทราบ" แล้ว
const NOTICE_SHOWN_KEY = 'mumate:notice-20261009-shown' // sessionStorage: เด้งไปแล้วรอบนี้
export const noticeActive = (now = Date.now()) => now < NOTICE.until

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
function noticeDismissed(): boolean {
  try {
    return window.localStorage.getItem(NOTICE_HIDE_KEY) === '1' || window.sessionStorage.getItem(NOTICE_SHOWN_KEY) === '1'
  } catch { return false }
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
  const [open, setOpen] = useState<'notice' | 'checkin' | null>(null)

  useEffect(() => {
    if (!isPromoPath(router.pathname)) return
    if (noticeActive()) {
      // ประกาศ: ทุกคน ไม่ดู status/wallet · โปรฯ เช็กอินไม่เด้งช่วงนี้
      if (noticeDismissed()) return
      const t = setTimeout(() => {
        try { window.sessionStorage.setItem(NOTICE_SHOWN_KEY, '1') } catch { /* private mode */ }
        setOpen('notice')
      }, 1200)
      return () => clearTimeout(t)
    }
    if (status !== 'authed') return
    if (hiddenNow() || shownThisSession()) return
    let alive = true
    const delay = new Promise((resolve) => setTimeout(resolve, 1200))
    void Promise.all([alreadyCheckedInToday(), delay]).then(([done]) => {
      if (!alive) return
      try { window.sessionStorage.setItem(SHOWN_KEY, '1') } catch { /* private mode */ }
      if (!done) setOpen('checkin')
    })
    return () => { alive = false }
  }, [status, router.pathname])

  const close = () => setOpen(null)
  const hide7d = () => {
    try { window.localStorage.setItem(HIDE_KEY, String(Date.now() + HIDE_DAYS * 24 * 60 * 60 * 1000)) } catch { /* private mode */ }
    setOpen(null)
  }
  const acknowledge = () => {
    try { window.localStorage.setItem(NOTICE_HIDE_KEY, '1') } catch { /* private mode */ }
    setOpen(null)
  }
  const go = () => { setOpen(null); void router.push(CHECKIN.href) }

  if (!open) return null

  const notice = open === 'notice'
  const tid = notice ? 'maintenance-notice' : 'promo-popup'

  return (
    <div className={`fixed inset-0 z-[75] flex items-center justify-center px-8 ${notice ? 'bg-black/60' : 'bg-black/50'}`} onClick={close} data-testid={`${tid}-scrim`}>
      <div className="relative w-full max-w-[340px]" onClick={(e) => e.stopPropagation()}
        {...(notice ? { role: 'dialog', 'aria-modal': true, 'aria-label': NOTICE.alt } : {})}>
        {/* ประกาศ: รูปโปร่งใสมีมาสคอตยื่นเหนือการ์ด — box-shadow วาดเป็นกรอบสี่เหลี่ยมรอบพื้นที่ใสแล้วดูลอย (owner 2026-10-06)
            จึงใช้ drop-shadow ที่เกาะรูปทรงจริงแทน + พื้นหลังมืดขึ้น (60%) ให้การ์ดสีอ่อนไม่กลืนกับหน้าแอป */}
        <button type="button" onClick={notice ? close : go} data-testid={`${tid}-image`} aria-label={notice ? NOTICE.alt : CHECKIN.alt}
          className={notice ? 'block w-full drop-shadow-[0_8px_20px_rgba(0,0,0,0.25)]' : 'block w-full overflow-hidden rounded-[24px] shadow-[0_12px_40px_rgba(0,0,0,0.35)]'}>
          {notice
            ? <Image src={NOTICE.src} alt={NOTICE.alt} width={NOTICE.width} height={NOTICE.height} priority className="h-auto w-full object-contain" />
            : <Image src={CHECKIN.src} alt={CHECKIN.alt} width={1000} height={1300} priority className="h-auto w-full object-contain" />}
        </button>

        <button type="button" onClick={close} aria-label="ปิด" data-testid={`${tid}-close`}
          className="absolute -top-3 -right-3 grid size-9 place-items-center rounded-full bg-white text-v3-navy shadow-lg">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="m6 6 12 12M18 6 6 18" /></svg>
        </button>

        {notice ? (
          <button type="button" onClick={acknowledge} data-testid="maintenance-notice-ack"
            className="mt-2 block w-full text-center text-[12px] font-medium text-white/80 underline">
            รับทราบ
          </button>
        ) : (
          <button type="button" onClick={hide7d} data-testid="promo-popup-hide"
            className="mt-2 block w-full text-center text-[12px] font-medium text-white/80 underline">
            ไม่แสดงอีกใน 7 วัน
          </button>
        )}
      </div>
    </div>
  )
}
