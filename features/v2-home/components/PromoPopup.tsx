// features/v2-home/components/PromoPopup.tsx — ป็อปอัปโปรโมชันหน้าแรก (สไตล์ Shopee: การ์ดภาพกลางจอ + ปุ่มปิด)
//
// พฤติกรรม: เด้ง 1 ครั้ง/วัน (จำการปิดใน localStorage), สุ่มโปรฯ 1 ใบจาก PROMOS, แตะภาพ → ไปหน้าที่เกี่ยวข้อง.
// ภาพอยู่ที่ public/images/v2/popup/*.png (ดีไซเนอร์ส่งมาในโฟลเดอร์ /popup). แก้/เพิ่มโปรฯ ที่ตาราง PROMOS ได้เลย.
import { useEffect, useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/router'

// โปรฯ ที่หมุนแสดง — src = ภาพเต็มใบ (พอร์ตเทรต), href = ปลายทางเมื่อแตะภาพ. ลำดับ/ปลายทางปรับได้ตามที่เอ็มต้องการ.
const PROMOS: { key: string; src: string; href: string; alt: string }[] = [
  { key: 'checkin', src: '/images/v2/popup/checkin.png', href: '/v2/qi/checkin', alt: 'เช็กอินทุกวัน รับ Qi ฟรี' },
  { key: 'book', src: '/images/v2/popup/book.png', href: '/v2/service/one-book', alt: 'เรียน & ดูดวงจีน ได้ไฟล์คู่มือดวงส่วนตัว' },
  { key: 'sinsae', src: '/images/v2/popup/sinsae.png', href: '/v2/service/sinsae', alt: 'ดูดวงกับซินแส ประสบการณ์ 20 ปี' },
  { key: 'ganesha', src: '/images/v2/popup/ganesha.png', href: '/v2/shop', alt: 'องค์พ่อพระพิฆเนศ รุ่นความสุข & ความสำเร็จ' },
  { key: 'calendar-course', src: '/images/v2/popup/calendar-course.png', href: '/v2/calendar', alt: 'คอร์สปฏิทิน เรียนฟรี วิธีอ่านปฏิทิน Mumate' },
]

const DISMISS_KEY = 'mumate:promo-popup-dismissed-at'
const DISMISS_HOURS = 24

function dismissedRecently(): boolean {
  try {
    const raw = window.localStorage.getItem(DISMISS_KEY)
    if (!raw) return false
    const at = Number(raw)
    if (!Number.isFinite(at)) return false
    return Date.now() - at < DISMISS_HOURS * 60 * 60 * 1000
  } catch {
    return false
  }
}

export function PromoPopup() {
  const router = useRouter()
  const [ready, setReady] = useState(false) // mount-gate: อย่าเรนเดอร์ก่อน client (กัน hydration + อ่าน localStorage)
  const [promo, setPromo] = useState<(typeof PROMOS)[number] | null>(null)

  useEffect(() => {
    if (PROMOS.length === 0) return
    // หน่วงให้หน้าแรกโผล่ก่อนค่อยเด้ง (ไม่กระโดดใส่ทันที) — ช้ากว่า InstallPromptSheet เล็กน้อยกันชนกัน
    const t = setTimeout(() => {
      if (dismissedRecently()) return
      setPromo(PROMOS[Math.floor(Math.random() * PROMOS.length)])
      setReady(true)
    }, 1600)
    return () => clearTimeout(t)
  }, [])

  const close = () => {
    try {
      window.localStorage.setItem(DISMISS_KEY, String(Date.now()))
    } catch {
      /* private mode — ปิดได้ แค่ไม่จำ */
    }
    setReady(false)
  }

  const go = () => {
    if (!promo) return
    close()
    void router.push(promo.href)
  }

  if (!ready || !promo) return null

  return (
    <div
      className="fixed inset-0 z-[75] flex items-center justify-center bg-black/50 px-8"
      onClick={close}
      data-testid="promo-popup-scrim"
    >
      <div className="relative w-full max-w-[340px]" onClick={(e) => e.stopPropagation()}>
        {/* ภาพโปรฯ เต็มใบ — แตะเพื่อไปหน้าที่เกี่ยวข้อง */}
        <button
          type="button"
          onClick={go}
          data-testid="promo-popup-image"
          aria-label={promo.alt}
          className="block w-full overflow-hidden rounded-[24px] shadow-[0_12px_40px_rgba(0,0,0,0.35)]"
        >
          <Image
            src={promo.src}
            alt={promo.alt}
            width={1000}
            height={1300}
            priority
            className="h-auto w-full object-contain"
          />
        </button>

        {/* ปุ่มปิด (X) มุมขวาบน นอกกรอบภาพเล็กน้อย — สไตล์ Shopee */}
        <button
          type="button"
          onClick={close}
          aria-label="ปิด"
          data-testid="promo-popup-close"
          className="absolute -top-3 -right-3 grid size-9 place-items-center rounded-full bg-white text-v3-navy shadow-lg"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
            <path d="m6 6 12 12M18 6 6 18" />
          </svg>
        </button>
      </div>
    </div>
  )
}
