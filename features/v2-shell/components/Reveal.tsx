// features/v2-shell/components/Reveal.tsx — "เลื่อนขึ้นเข้ามา" ตอนสกรอลล์ถึง (ฟีม สไลด์ 13: อยากได้แบบ apple.com/iphone)
//
// ทำด้วย IntersectionObserver + CSS transition ล้วน ไม่ใช้ framer-motion เพราะ (1) SSR: HTML แรกต้องมองเห็นทันที
// ถ้า JS ยังไม่มา — คลาส `is-in` ถูกใส่ตอน mount เฉพาะเมื่อมี observer จริง ไม่งั้นไม่ซ่อนอะไรเลย (2) หน้าเหล่านี้
// มีการ์ดเยอะ ไม่อยากแบก motion runtime ต่อการ์ด. reduced-motion → ไม่เลื่อน ไม่จาง (สไตล์ใน globals.css).
//
// ใช้: <Reveal><section …/></Reveal> หรือ <Reveal as="li" delay={i * 60}>…</Reveal>
// เล่นครั้งเดียว (unobserve หลังเข้าเฟรม) — การ์ดที่เลื่อนผ่านไปแล้วไม่กระพริบซ้ำตอนเลื่อนกลับ
import { useEffect, useRef, useState, type ElementType, type ReactNode } from 'react'

const REDUCED = '(prefers-reduced-motion: reduce)'

export function Reveal({
  as: Tag = 'div',
  delay = 0,
  className = '',
  children,
  testId,
}: {
  as?: ElementType
  /** ms — ใช้เรียงการ์ดในลิสต์ (i * 60) */
  delay?: number
  className?: string
  children: ReactNode
  testId?: string
}) {
  const ref = useRef<HTMLElement | null>(null)
  // null = ยังไม่ตัดสิน (SSR / ก่อน effect) → ไม่ใส่คลาสซ่อน; false = รอเลื่อนถึง; true = เข้าเฟรมแล้ว
  const [shown, setShown] = useState<boolean | null>(null)

  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    if (typeof window !== 'undefined' && window.matchMedia?.(REDUCED).matches) return
    // อยู่ในจอตั้งแต่แรก (above the fold) → โชว์เลย ไม่บังคับให้เลื่อนก่อน
    const r = el.getBoundingClientRect()
    if (r.top < window.innerHeight * 0.9 && r.bottom > 0) { setShown(true); return }
    setShown(false)
    let done = false
    const show = () => {
      if (done) return
      done = true
      setShown(true)
      io.disconnect()
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) show()
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.08 },
    )
    // 🔴 safety net: การ์ดที่ซ่อนอยู่ (opacity 0) ต้องมีทางโผล่แม้ IO ไม่ยิง (แท็บพื้นหลัง/WebView บางตัวไม่ยิง
    // callback จนกว่าจะ paint) — เช็ค rect เองตอน scroll/resize แบบ passive; และกันเหนียวด้วย timer 4 วิ
    // เผื่อทั้งสองทางเงียบ: ยอมให้การ์ดโผล่ก่อนเวลาดีกว่าไม่มีวันโผล่
    const onScroll = () => {
      const b = el.getBoundingClientRect()
      if (b.top < window.innerHeight * 0.92 && b.bottom > 0) show()
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll, { passive: true })
    io.observe(el)
    const guard = window.setTimeout(show, 4000)
    return () => { window.clearTimeout(guard); io.disconnect(); window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll) }
  }, [])

  const state = shown === null ? '' : shown ? ' v2-reveal is-in' : ' v2-reveal'
  return (
    <Tag
      ref={ref}
      data-testid={testId}
      data-reveal={shown === null ? undefined : shown ? 'in' : 'out'}
      className={`${className}${state}`}
      style={delay ? ({ ['--reveal-delay' as string]: `${delay}ms` } as React.CSSProperties) : undefined}
    >
      {children}
    </Tag>
  )
}

export default Reveal
