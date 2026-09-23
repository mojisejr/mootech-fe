// features/v2-home/components/PromoCarousel.tsx — แถบโปรโมชันในหน้าหลัก (ใต้การ์ดมานิเฟส) เอ็ม 2026-09-23.
// โปรฯ ที่ไม่ใช่เช็กอิน (คู่มือ/ซินแส/พระพิฆเนศ/คอร์สปฏิทิน). แสดง "เต็มรูป" ไม่ตัดขอบ (h-auto) + ปัดเลื่อนได้
// (transform translateX + touch handlers — เชื่อถือได้กว่า native scroll-snap ที่ปุ่มบังการปัด) + auto ~4.5 วิ.
import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/router'
import { openInExternalBrowser } from '@/lib/line/liff'

const PROMOS: { key: string; src: string; href: string; alt: string }[] = [
  { key: 'book', src: '/images/v2/popup/book.png', href: '/v2/service/one-book', alt: 'เรียน & ดูดวงจีน ได้ไฟล์คู่มือดวงส่วนตัว' },
  { key: 'sinsae', src: '/images/v2/popup/sinsae.png', href: '/v2/service/sinsae', alt: 'ดูดวงกับซินแส ประสบการณ์ 20 ปี' },
  { key: 'ganesha', src: '/images/v2/popup/ganesha.png', href: 'https://www.facebook.com/Mumate.co/posts/pfbid0VhDkDaXmN9DFEqgJC6sPe1DuPNYhooa26sMkDEGo75FiXU2iZ6mkbcU6JC4ZLSYQl', alt: 'องค์พ่อพระพิฆเนศ รุ่นความสุข & ความสำเร็จ' },
  // TODO(เอ็ม): URL คอร์สปฏิทิน (ลิงก์ภายนอก) — ชั่วคราวไปหน้าปฏิทิน
  { key: 'calendar-course', src: '/images/v2/popup/calendar-course.png', href: '/v2/calendar', alt: 'คอร์สปฏิทิน เรียนฟรี วิธีอ่านปฏิทิน Mumate' },
]

export function PromoCarousel() {
  const router = useRouter()
  const [idx, setIdx] = useState(0)
  const startX = useRef<number | null>(null)
  const moved = useRef(false) // กันปัดแล้วเผลอเปิดลิงก์ (ถือว่าเป็นปัดถ้าเลื่อนเกิน 10px)
  const paused = useRef(false)
  const n = PROMOS.length

  useEffect(() => {
    if (n <= 1) return
    const t = setInterval(() => { if (!paused.current) setIdx((i) => (i + 1) % n) }, 4500)
    return () => clearInterval(t)
  }, [n])

  const go = (href: string) => {
    if (moved.current) return // เพิ่งปัด → ไม่ถือเป็นการกด
    if (/^https?:\/\//i.test(href)) { void openInExternalBrowser(href); return }
    void router.push(href)
  }

  const onTouchStart = (e: React.TouchEvent) => { startX.current = e.touches[0]?.clientX ?? null; moved.current = false; paused.current = true }
  const onTouchMove = (e: React.TouchEvent) => {
    if (startX.current == null) return
    if (Math.abs((e.touches[0]?.clientX ?? startX.current) - startX.current) > 10) moved.current = true
  }
  const onTouchEnd = (e: React.TouchEvent) => {
    const s = startX.current; startX.current = null; paused.current = false
    if (s == null) return
    const dx = (e.changedTouches[0]?.clientX ?? s) - s
    if (Math.abs(dx) > 40) setIdx((i) => (i + (dx < 0 ? 1 : -1) + n) % n)
  }

  if (n === 0) return null

  return (
    <section className="mb-6 mt-1" aria-label="โปรโมชัน" data-testid="promo-carousel">
      <div className="overflow-hidden rounded-[20px] shadow-sm" onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
        <div className="flex transition-transform duration-300 ease-out" style={{ transform: `translateX(-${idx * 100}%)` }}>
          {PROMOS.map((p) => (
            <button key={p.key} type="button" onClick={() => go(p.href)} aria-label={p.alt} className="w-full flex-none">
              {/* เต็มรูป ไม่ตัดขอบ (h-auto ตามสัดส่วนจริง) */}
              <Image src={p.src} alt={p.alt} width={1000} height={1300} sizes="(max-width:480px) 100vw, 448px" className="h-auto w-full" />
            </button>
          ))}
        </div>
      </div>
      {n > 1 && (
        <div className="mt-2 flex justify-center gap-1.5">
          {PROMOS.map((p, i) => (
            <button key={p.key} type="button" onClick={() => setIdx(i)} aria-label={`โปรฯ ${i + 1}`}
              className={'h-2 rounded-full transition-all ' + (i === idx ? 'w-5 bg-v3-sapphire' : 'w-2 bg-v3-sapphire/30')} />
          ))}
        </div>
      )}
    </section>
  )
}
