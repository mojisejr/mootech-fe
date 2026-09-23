// features/v2-home/components/PromoCarousel.tsx — แถบโปรโมชันในหน้าหลัก (ใต้การ์ดมานิเฟส) เอ็ม 2026-09-23.
// โปรฯ ที่ไม่ใช่เช็กอิน (คู่มือ/ซินแส/พระพิฆเนศ/คอร์สปฏิทิน) — เลื่อนเองได้ (scroll-snap) + auto เลื่อนทุก ~4.5 วิ.
// แตะรูป = ไปหน้าที่เกี่ยว (ภายใน → router.push, ลิงก์นอก http → เปิดเบราว์เซอร์ภายนอกเมื่ออยู่ใน LINE).
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
  const scroller = useRef<HTMLDivElement>(null)
  const [idx, setIdx] = useState(0)
  const paused = useRef(false)

  // auto เลื่อนทุก ~4.5 วิ (หยุดชั่วคราวตอนผู้ใช้แตะ/ปัด)
  useEffect(() => {
    if (PROMOS.length <= 1) return
    const t = setInterval(() => {
      if (paused.current) return
      setIdx((i) => (i + 1) % PROMOS.length)
    }, 4500)
    return () => clearInterval(t)
  }, [])

  // เลื่อน scroller ไปยังสไลด์ idx (ทั้ง auto และกดจุด)
  useEffect(() => {
    const el = scroller.current
    if (!el) return
    el.scrollTo({ left: idx * el.clientWidth, behavior: 'smooth' })
  }, [idx])

  const go = (href: string) => {
    if (/^https?:\/\//i.test(href)) { void openInExternalBrowser(href); return }
    void router.push(href)
  }
  // อัปเดต idx ตามการปัดเอง (ให้จุดตรงกับสไลด์)
  const onScroll = () => {
    const el = scroller.current
    if (!el) return
    const i = Math.round(el.scrollLeft / el.clientWidth)
    if (i !== idx) setIdx(i)
  }

  if (PROMOS.length === 0) return null

  return (
    <section className="mb-6 mt-1" aria-label="โปรโมชัน" data-testid="promo-carousel">
      <div
        ref={scroller}
        onScroll={onScroll}
        onPointerDown={() => { paused.current = true }}
        onPointerUp={() => { paused.current = false }}
        className="flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {PROMOS.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => go(p.href)}
            aria-label={p.alt}
            className="relative aspect-[4/3] w-full flex-none snap-center overflow-hidden rounded-[20px] bg-v3-pastel-sky shadow-sm"
          >
            <Image src={p.src} alt={p.alt} fill sizes="(max-width:480px) 100vw, 448px" className="object-cover object-top" />
          </button>
        ))}
      </div>
      {PROMOS.length > 1 && (
        <div className="mt-2 flex justify-center gap-1.5">
          {PROMOS.map((p, i) => (
            <button
              key={p.key}
              type="button"
              onClick={() => setIdx(i)}
              aria-label={`โปรฯ ${i + 1}`}
              className={'h-2 rounded-full transition-all ' + (i === idx ? 'w-5 bg-v3-sapphire' : 'w-2 bg-v3-sapphire/30')}
            />
          ))}
        </div>
      )}
    </section>
  )
}
