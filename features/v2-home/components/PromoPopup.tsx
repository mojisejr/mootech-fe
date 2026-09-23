// features/v2-home/components/PromoPopup.tsx — ป็อปอัปโปรโมชัน (สไตล์ Shopee) แบบ carousel เลื่อนดูได้หลายใบ.
//
// พฤติกรรม (เอ็ม 2026-09-23):
//   • เลื่อนดูได้หลายใบ (ลูกศร/จุด/ปัดนิ้ว) — แตะที่ "รูป" = ไปหน้าที่โปรฯ นั้นลิงก์ไว้
//   • เด้งครอบทั้งแอป /v2 (mount ที่ _app) — เข้าหน้าใหม่แล้วเด้ง "สลับใบ" (หมุนไปโปรฯ ถัดไป)
//   • ปุ่มปิด (X / แตะพื้นหลัง) = ปิดเฉย ๆ → ไปหน้าอื่นเด้งใหม่ (ใบสลับ)
//   • ลิงก์ "ไม่แสดงอีก" = ปิดทั้ง session (sessionStorage) → เด้งใหม่เมื่อเปิดแอปใหม่ (session ใหม่)
// รูปอยู่ที่ public/images/v2/popup/*.png. แก้/เพิ่ม/ลำดับ/ปลายทาง = แก้ที่ตาราง PROMOS ได้เลย.
import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/router'

const PROMOS: { key: string; src: string; href: string; alt: string }[] = [
  { key: 'checkin', src: '/images/v2/popup/checkin.png', href: '/v2/qi/checkin', alt: 'เช็กอินทุกวัน รับ Qi ฟรี' },
  { key: 'book', src: '/images/v2/popup/book.png', href: '/v2/service/one-book', alt: 'เรียน & ดูดวงจีน ได้ไฟล์คู่มือดวงส่วนตัว' },
  { key: 'sinsae', src: '/images/v2/popup/sinsae.png', href: '/v2/service/sinsae', alt: 'ดูดวงกับซินแส ประสบการณ์ 20 ปี' },
  { key: 'ganesha', src: '/images/v2/popup/ganesha.png', href: '/v2/shop', alt: 'องค์พ่อพระพิฆเนศ รุ่นความสุข & ความสำเร็จ' },
  { key: 'calendar-course', src: '/images/v2/popup/calendar-course.png', href: '/v2/calendar', alt: 'คอร์สปฏิทิน เรียนฟรี วิธีอ่านปฏิทิน Mumate' },
]

const SESSION_HIDE_KEY = 'mumate:promo-hidden-session' // ปิดทั้ง session (ล้างเมื่อเปิดแอปใหม่)
const ROT_KEY = 'mumate:promo-rot' // ตัวชี้รอบหมุน (โปรฯ ที่จะเด้งเป็นใบแรกครั้งถัดไป)

// ไม่เด้งบนหน้าที่ไม่ใช่แอปหลัก (login/สมัคร/onboarding/gate) — โปรฯ มีไว้สำหรับผู้ใช้ที่เข้าแอปแล้ว
const EXCLUDE = ['/v2/login', '/v2/register', '/v2/onboarding', '/v2/first-run', '/v2/first-run-preview']
function isPromoPath(path: string): boolean {
  if (!(path === '/v2' || path.startsWith('/v2/'))) return false
  return !EXCLUDE.some((p) => path === p || path.startsWith(`${p}/`))
}

export function PromoPopup() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [slide, setSlide] = useState(0)
  const suppressNext = useRef(false) // กันเด้งซ้ำทันทีตอนแตะโปรฯ แล้วเปลี่ยนหน้าไปเอง
  const touchX = useRef<number | null>(null)

  const sessionHidden = (): boolean => {
    try { return window.sessionStorage.getItem(SESSION_HIDE_KEY) === '1' } catch { return false }
  }
  // คืน index ที่จะเด้งรอบนี้ แล้วเลื่อนตัวชี้ไปใบถัดไปสำหรับรอบหน้า (หมุนวน)
  const takeRotation = (): number => {
    if (PROMOS.length === 0) return 0
    let cur = 0
    try {
      cur = (Number(window.sessionStorage.getItem(ROT_KEY)) || 0) % PROMOS.length
      window.sessionStorage.setItem(ROT_KEY, String((cur + 1) % PROMOS.length))
    } catch { /* private mode → เริ่มที่ 0 เสมอ */ }
    return cur
  }
  const popup = () => {
    if (sessionHidden() || PROMOS.length === 0) return
    setSlide(takeRotation())
    setOpen(true)
  }

  // เด้งครั้งแรกเมื่อเข้าแอป (mount ครั้งเดียวที่ _app) ถ้าอยู่บนหน้าโปรฯ
  useEffect(() => {
    if (!isPromoPath(router.pathname)) return
    const t = setTimeout(popup, 1200)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // เด้งซ้ำ "สลับใบ" เมื่อเปลี่ยนไปหน้า /v2 ใหม่ (routeChangeComplete)
  useEffect(() => {
    const onDone = (url: string) => {
      const path = url.split('?')[0]
      setOpen(false) // ปิดใบของหน้าเดิมก่อนเสมอ
      if (suppressNext.current) { suppressNext.current = false; return } // มาจากการแตะโปรฯ → ไม่เด้งทับ
      if (!isPromoPath(path)) return
      window.setTimeout(popup, 400)
    }
    router.events.on('routeChangeComplete', onDone)
    return () => router.events.off('routeChangeComplete', onDone)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.events])

  const close = () => setOpen(false) // ปิดเฉย ๆ → ไปหน้าอื่นเด้งใหม่
  const hideForSession = () => {
    try { window.sessionStorage.setItem(SESSION_HIDE_KEY, '1') } catch { /* private mode — ปิดได้ แค่ไม่จำ */ }
    setOpen(false)
  }
  const go = (href: string) => {
    suppressNext.current = true
    setOpen(false)
    void router.push(href)
  }
  const step = (dir: 1 | -1) => setSlide((s) => (s + dir + PROMOS.length) % PROMOS.length)

  const onTouchStart = (e: React.TouchEvent) => { touchX.current = e.touches[0]?.clientX ?? null }
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchX.current == null) return
    const dx = (e.changedTouches[0]?.clientX ?? touchX.current) - touchX.current
    if (Math.abs(dx) > 40) step(dx < 0 ? 1 : -1) // ปัดซ้าย = ใบถัดไป
    touchX.current = null
  }

  if (!open || PROMOS.length === 0) return null
  const promo = PROMOS[slide]

  return (
    <div className="fixed inset-0 z-[75] flex items-center justify-center bg-black/50 px-8" onClick={close} data-testid="promo-popup-scrim">
      <div className="relative w-full max-w-[340px]" onClick={(e) => e.stopPropagation()} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        {/* ภาพโปรฯ — แตะเพื่อไปหน้าที่เกี่ยวข้อง */}
        <button type="button" onClick={() => go(promo.href)} data-testid="promo-popup-image" aria-label={promo.alt}
          className="block w-full overflow-hidden rounded-[24px] shadow-[0_12px_40px_rgba(0,0,0,0.35)]">
          <Image src={promo.src} alt={promo.alt} width={1000} height={1300} priority className="h-auto w-full object-contain" />
        </button>

        {/* ลูกศรเลื่อน (โชว์เมื่อมีมากกว่า 1 ใบ) */}
        {PROMOS.length > 1 ? (
          <>
            <button type="button" onClick={() => step(-1)} aria-label="ก่อนหน้า" data-testid="promo-popup-prev"
              className="absolute left-[-6px] top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-v3-navy shadow-lg">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
            </button>
            <button type="button" onClick={() => step(1)} aria-label="ถัดไป" data-testid="promo-popup-next"
              className="absolute right-[-6px] top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-v3-navy shadow-lg">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
            </button>
          </>
        ) : null}

        {/* ปุ่มปิด (X) — ปิดเฉย ๆ */}
        <button type="button" onClick={close} aria-label="ปิด" data-testid="promo-popup-close"
          className="absolute -top-3 -right-3 grid size-9 place-items-center rounded-full bg-white text-v3-navy shadow-lg">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="m6 6 12 12M18 6 6 18" /></svg>
        </button>

        {/* จุดบอกจำนวนใบ + ใบปัจจุบัน */}
        {PROMOS.length > 1 ? (
          <div className="mt-3 flex justify-center gap-1.5" data-testid="promo-popup-dots">
            {PROMOS.map((p, i) => (
              <button key={p.key} type="button" onClick={() => setSlide(i)} aria-label={`ใบที่ ${i + 1}`}
                className={'h-2 rounded-full transition-all ' + (i === slide ? 'w-5 bg-white' : 'w-2 bg-white/45')} />
            ))}
          </div>
        ) : null}

        {/* ไม่แสดงอีก (ทั้ง session) */}
        <button type="button" onClick={hideForSession} data-testid="promo-popup-hide"
          className="mt-2 block w-full text-center text-[12px] font-medium text-white/80 underline">
          ไม่แสดงอีก
        </button>
      </div>
    </div>
  )
}
