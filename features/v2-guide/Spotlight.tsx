// features/v2-guide/Spotlight.tsx — ชั้นส่องไฟที่ทัวร์แนะนำแอป (OnboardingTour) และไกด์คนใหม่ (NewcomerCoach) ใช้ร่วมกัน
// ให้ลื่นแบบ coach mark ของ LINE (เอ็ม 2026-10-14 "ไม่ smooth เลย"):
//   • เปลี่ยนขั้น = ช่องส่อง "เลื่อน" จากจุดเดิมไปจุดใหม่ (ไม่หายแล้วโผล่ ไม่มีจอมืดทึบแวบ)
//   • ระหว่างนั้นตามตำแหน่งทุกเฟรมแบบไม่มี transition (จอเลื่อนแล้วช่องไม่หนืดตาม — transition ที่โดนตั้งค่าใหม่ทุกเฟรม = กระตุก)
//   • ชั้นมืดค่อยๆ จางเข้าตอนเริ่ม · กล่องคำพูดค่อยๆ ลอยขึ้นทุกครั้งที่เปลี่ยนขั้น
// การแตะ: ช่องว่างโปร่งใส 4 ชิ้นรอบช่อง (มองไม่เห็น → ไม่มีรอยต่อ) กันแตะนอกช่อง · ในช่องแล้วแต่ mode
import { useEffect, useRef, useState, type ReactNode } from "react"

export type Rect = { top: number; left: number; width: number; height: number }

/** ช่องส่อง (เผื่อขอบ pad) ไม่ล้นจอบน/ล่าง */
export function holeOf(rect: Rect, pad: number, vh: number): Rect {
  const top = Math.max(rect.top - pad, 4)
  const bottom = Math.min(rect.top + rect.height + pad, vh - 4)
  return { top, left: rect.left - pad, width: rect.width + pad * 2, height: Math.max(bottom - top, 0) }
}

const same = (a: Rect | null, b: Rect | null) =>
  !!a && !!b && Math.abs(a.top - b.top) < 0.5 && Math.abs(a.left - b.left) < 0.5 && Math.abs(a.width - b.width) < 0.5 && Math.abs(a.height - b.height) < 0.5

/**
 * ตามตำแหน่ง element ทุกเฟรม (requestAnimationFrame) — คืน rect ล่าสุด (ไม่เปลี่ยน = ไม่ re-render)
 * find() คืน element ที่จะส่อง (หลายอัน = คลุมทุกอัน) · ไม่เจอ = คง rect เดิมไว้ (ช่องไม่หายระหว่างรอหน้าโหลด)
 */
export function useTrackedRect(key: unknown, find: () => HTMLElement[], onFirstFound?: (els: HTMLElement[]) => void, onTick?: (found: boolean) => void): Rect | null {
  const [rect, setRect] = useState<Rect | null>(null)
  const findRef = useRef(find)
  findRef.current = find
  const firstRef = useRef(onFirstFound)
  firstRef.current = onFirstFound
  const tickRef = useRef(onTick)
  tickRef.current = onTick

  useEffect(() => {
    if (key === null || key === undefined) {
      setRect(null)
      return
    }
    let raf = 0
    let found = false
    const loop = () => {
      const els = findRef.current()
      if (els.length > 0) {
        if (!found) {
          found = true
          firstRef.current?.(els)
        }
        const rs = els.map((el) => el.getBoundingClientRect())
        const top = Math.min(...rs.map((r) => r.top))
        const left = Math.min(...rs.map((r) => r.left))
        const next = { top, left, width: Math.max(...rs.map((r) => r.right)) - left, height: Math.max(...rs.map((r) => r.bottom)) - top }
        setRect((prev) => (same(prev, next) ? prev : next))
      }
      tickRef.current?.(els.length > 0)
      raf = window.requestAnimationFrame(loop)
    }
    loop()
    return () => window.cancelAnimationFrame(raf)
  }, [key])

  return rect
}

type Props = {
  /** เปลี่ยนเมื่อเปลี่ยนขั้น → ช่องเลื่อนไปจุดใหม่ + กล่องคำพูดลอยขึ้นใหม่ */
  stepKey: string | number
  hole: Rect | null
  /** "pass" = แตะในช่องทะลุไปกดของจริง (บังคับกด) · "catch" = แตะในช่องเรียก onHoleTap (ไม่ออกจากหน้า) */
  mode: "pass" | "catch"
  onHoleTap?: () => void
  bubble: ReactNode
  /** ตำแหน่งกล่องคำพูด (top หรือ bottom) */
  bubbleStyle: React.CSSProperties
  testId: string
  spotTestId: string
}

const GLIDE_MS = 420
const EASE = "cubic-bezier(0.22, 1, 0.36, 1)"

export function Spotlight({ stepKey, hole, mode, onHoleTap, bubble, bubbleStyle, testId, spotTestId }: Props) {
  // จางเข้าตอนเริ่ม
  const [shown, setShown] = useState(false)
  useEffect(() => {
    const id = window.requestAnimationFrame(() => setShown(true))
    return () => window.cancelAnimationFrame(id)
  }, [])

  // เปลี่ยนขั้น → เปิด transition ค้างไว้จนช่องของขั้นใหม่โผล่ (อาจรอเปลี่ยนหน้า) แล้วเลื่อนไปอีก GLIDE_MS ค่อยปิด
  // (นอกช่วงนี้ตามทุกเฟรมแบบไม่มี transition) + กล่องคำพูดลอยขึ้นใหม่
  const [gliding, setGliding] = useState(false)
  const [bubbleIn, setBubbleIn] = useState(false)
  const firstStep = useRef(true)
  const pending = useRef(false)
  useEffect(() => {
    setBubbleIn(false)
    const raf = window.requestAnimationFrame(() => window.requestAnimationFrame(() => setBubbleIn(true)))
    if (firstStep.current) firstStep.current = false
    else {
      pending.current = true
      setGliding(true)
    }
    return () => window.cancelAnimationFrame(raf)
  }, [stepKey])
  const arrived = !!hole
  useEffect(() => {
    if (!gliding || !arrived) return
    pending.current = false
    const t = window.setTimeout(() => setGliding(false), GLIDE_MS)
    return () => window.clearTimeout(t)
  }, [gliding, arrived, stepKey])

  // จำช่องล่าสุดไว้ — ระหว่างหาเป้าหมายขั้นใหม่ ช่องค้างที่เดิม (ไม่หายเป็นจอมืดทึบ)
  const lastHole = useRef<Rect | null>(null)
  if (hole) lastHole.current = hole
  const h = hole ?? lastHole.current

  const vw = typeof window === "undefined" ? 400 : window.innerWidth
  const vh = typeof window === "undefined" ? 800 : window.innerHeight
  // เป้าชิดล่างจอ (แถบเมนู) → มือชี้ลงจากเหนือปุ่ม · อื่นๆ มือชี้ขึ้นจากในช่อง
  const handAbove = !!h && h.top + h.height > vh - 120
  const glide = gliding ? `transform ${GLIDE_MS}ms ${EASE}, width ${GLIDE_MS}ms ${EASE}, height ${GLIDE_MS}ms ${EASE}` : "none"
  const tapHole = mode === "catch" && onHoleTap ? onHoleTap : undefined

  return (
    <div
      className="fixed inset-0 z-[80]"
      style={{ opacity: shown ? 1 : 0, transition: "opacity 260ms ease-out", pointerEvents: "none" }}
      data-testid={testId}
    >
      {h ? (
        <>
          {/* ภาพ: กรอบเดียว + เงา 9999px = ชั้นมืดรอบช่อง (เคลื่อนด้วย transform = ลื่น ใช้ GPU) */}
          <div
            className="absolute left-0 top-0 rounded-[18px] border-2 border-white/80"
            style={{
              width: h.width,
              height: h.height,
              transform: `translate3d(${h.left}px, ${h.top}px, 0)`,
              transition: glide,
              boxShadow: "0 0 0 9999px rgba(0,0,0,0.72), 0 0 18px 4px rgba(255,255,255,0.55)",
              willChange: "transform, width, height",
            }}
            data-testid={spotTestId}
          />
          {/* การแตะ: 4 ชิ้นโปร่งใสรอบช่องกันแตะ · ช่องเอง pass = ทะลุ / catch = ชิ้นที่ 5 รับแตะ */}
          <div className="pointer-events-auto absolute" data-testid={`${testId}-block`} style={{ top: 0, left: 0, width: vw, height: Math.max(h.top, 0) }} />
          <div className="pointer-events-auto absolute" data-testid={`${testId}-block`} style={{ top: h.top + h.height, left: 0, width: vw, bottom: 0 }} />
          <div className="pointer-events-auto absolute" data-testid={`${testId}-block`} style={{ top: h.top, left: 0, width: Math.max(h.left, 0), height: h.height }} />
          <div className="pointer-events-auto absolute" data-testid={`${testId}-block`} style={{ top: h.top, left: h.left + h.width, right: 0, height: h.height }} />
          {tapHole ? (
            <button type="button" aria-label="ถัดไป" className="pointer-events-auto absolute" style={{ top: h.top, left: h.left, width: h.width, height: h.height }} onClick={tapHole} data-testid={`${testId}-hole`} />
          ) : null}
          <span
            aria-hidden
            className="pointer-events-none absolute left-0 top-0 text-[40px] drop-shadow-lg"
            style={{ transform: `translate3d(${h.left + Math.max(h.width * (handAbove ? 0.5 : 0.7) - 20, 0)}px, ${handAbove ? h.top - 52 : h.top + h.height * 0.55}px, 0)`, transition: glide }}
          >
            <span className="block animate-bounce">{handAbove ? "👇" : "👆"}</span>
          </span>
        </>
      ) : (
        <div className="pointer-events-auto absolute inset-0 bg-black/[0.72]" />
      )}

      <div
        className="pointer-events-auto absolute inset-x-0 mx-auto flex w-full max-w-md items-end gap-2 px-4"
        style={{
          ...bubbleStyle,
          opacity: bubbleIn ? 1 : 0,
          transform: bubbleIn ? "translateY(0)" : "translateY(10px)",
          transition: `opacity 260ms ease-out, transform 320ms ${EASE}`,
        }}
      >
        {bubble}
      </div>
    </div>
  )
}
