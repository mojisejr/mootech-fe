// features/v2-guide/NewcomerCoach.tsx — พาคนใหม่ (ยังไม่มีบัญชี) หาธาตุฟรีก่อนสมัคร (เอ็ม 2026-10-14 "ร่างเลย แล้ว qi ค่อยได้หลังมีบัญชี")
// หน้าแนะนำ 4 หน้า → /v2/element-finder?newcomer=1 → บังคับกดทีละขั้น (แบบคลิป LINE): วันเกิด → เวลาเกิด → ดูธาตุ → สมัครฟรี
// บังคับกด = หรี่จอ + กันแตะทุกที่ยกเว้นส่วนที่ส่อง (ผู้ใช้กดของจริงเอง) · ขั้นเลือกจากสถานะหน้า (หน้าส่ง step มา)
// วันเกิดที่กรอกจำไว้ให้หน้าสมัคร (/v2/register) เติมให้เอง ไม่ต้องกรอกซ้ำ · ยังไม่มี QI (ยังไม่มีบัญชี) — QI มาจากทัวร์หลังสมัคร
import { useEffect, useState } from "react"

const FLAG = "mumate-newcomer"
const BIRTH = "mumate-newcomer-birth"
const MASCOT = "/images/v2/mascot/01-nav.png"
const PAD = 8

export type NewcomerBirth = { date: string; time: string }

/** มาจากหน้าแนะนำ (?newcomer=1) — จำไว้ทั้ง session (รีเฟรช/ย้อนกลับยังพาต่อ) */
export function useNewcomer(query: unknown): boolean {
  const [on, setOn] = useState(false)
  useEffect(() => {
    try {
      if (query === "1") window.sessionStorage.setItem(FLAG, "1")
      setOn(query === "1" || window.sessionStorage.getItem(FLAG) === "1")
    } catch {
      setOn(query === "1")
    }
  }, [query])
  return on
}

export function saveNewcomerBirth(b: NewcomerBirth) {
  try {
    window.sessionStorage.setItem(BIRTH, JSON.stringify(b))
  } catch {
    /* storage ปิด */
  }
}

/** วันเกิดที่กรอกตอนหาธาตุ (ถ้ามี) — หน้าสมัครใช้เติมให้ */
export function readNewcomerBirth(): NewcomerBirth | null {
  try {
    const j = JSON.parse(window.sessionStorage.getItem(BIRTH) ?? "null") as Partial<NewcomerBirth> | null
    return j && typeof j.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(j.date) ? { date: j.date, time: typeof j.time === "string" ? j.time : "" } : null
  } catch {
    return null
  }
}

export function clearNewcomer() {
  try {
    window.sessionStorage.removeItem(FLAG)
    window.sessionStorage.removeItem(BIRTH)
  } catch {
    /* storage ปิด */
  }
}

export type NewcomerStep = { target: string; text: string }

export const NEWCOMER_STEPS = {
  date: { target: '[data-testid="finder-date"]', text: "เริ่มจากเลือกวันเกิดของคุณตรงนี้เลย" },
  time: { target: '[data-testid="finder-time-block"]', text: "ใส่เวลาเกิด (ถ้ารู้ จะแม่นขึ้น) หรือติ๊ก \"ไม่ทราบเวลา\"" },
  submit: { target: '[data-testid="finder-submit"]', text: "กดเลย! ดูว่าคุณคือธาตุอะไร" },
  signup: { target: '[data-testid="finder-cta"]', text: "ชอบไหม? สมัครฟรีด้วย LINE ดูดวงเต็ม + รับพลังชี่ (QI) ฟรี" },
} satisfies Record<string, NewcomerStep>

const ORDER: (keyof typeof NEWCOMER_STEPS)[] = ["date", "time", "submit", "signup"]

type Rect = { top: number; left: number; width: number; height: number }

export function NewcomerCoach({ step }: { step: keyof typeof NEWCOMER_STEPS | null }) {
  const [rect, setRect] = useState<Rect | null>(null)

  // ตามตำแหน่งส่วนที่ส่องทุกเฟรม (หน้าเลื่อน/โหลดรูป — ทุก 200ms ตามไม่ทันตอนเลื่อน) · ขั้นใหม่ = เลื่อนให้เห็นครั้งเดียว
  useEffect(() => {
    setRect(null)
    if (!step) return
    let scrolled = false
    const track = () => {
      const el = document.querySelector<HTMLElement>(NEWCOMER_STEPS[step].target)
      const r = el?.getBoundingClientRect()
      if (!el || !r || r.width === 0) return setRect(null)
      if (!scrolled) {
        scrolled = true
        el.scrollIntoView({ block: "center", behavior: "smooth" })
      }
      const next = { top: r.top - PAD, left: r.left - PAD, width: r.width + PAD * 2, height: r.height + PAD * 2 }
      setRect((prev) => (prev && prev.top === next.top && prev.left === next.left && prev.width === next.width && prev.height === next.height ? prev : next))
    }
    let raf = 0
    const loop = () => {
      track()
      raf = window.requestAnimationFrame(loop)
    }
    loop()
    return () => window.cancelAnimationFrame(raf)
  }, [step])

  if (!step || !rect) return null

  const vw = window.innerWidth
  const vh = window.innerHeight
  const below = rect.top + rect.height / 2 < vh / 2
  // ฉากกัน 4 ชิ้นรอบช่อง: แตะได้เฉพาะส่วนที่ส่อง (ของจริง) — ที่อื่นกดไม่ได้
  const block = "absolute bg-black/[0.72] pointer-events-auto"
  return (
    <div className="pointer-events-none fixed inset-0 z-[80]" data-testid="newcomer-coach">
      <div className={block} style={{ top: 0, left: 0, width: vw, height: Math.max(rect.top, 0) }} />
      <div className={block} style={{ top: rect.top + rect.height, left: 0, width: vw, bottom: 0 }} />
      <div className={block} style={{ top: rect.top, left: 0, width: Math.max(rect.left, 0), height: rect.height }} />
      <div className={block} style={{ top: rect.top, left: rect.left + rect.width, right: 0, height: rect.height }} />
      <div
        className="absolute rounded-[16px] border-2 border-white/80"
        style={{ ...rect, boxShadow: "0 0 18px 4px rgba(255,255,255,0.55)" }}
        data-testid="newcomer-spotlight"
      />
      <span aria-hidden className="absolute animate-bounce text-[38px] drop-shadow-lg" style={{ top: rect.top + rect.height * 0.5, left: rect.left + Math.max(rect.width * 0.7 - 20, 0) }}>
        👆
      </span>
      <div
        className="absolute inset-x-0 mx-auto flex w-full max-w-md items-end gap-2 px-4"
        style={below ? { top: rect.top + rect.height + 16 } : { bottom: vh - rect.top + 16 }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={MASCOT} alt="เสี่ยวมู่" className="h-16 w-auto flex-none drop-shadow" />
        <div className="flex-1 rounded-[18px] bg-white p-3 shadow-lg">
          <p className="text-[11px] font-black text-v3-sapphire">
            {ORDER.indexOf(step) + 1}/{ORDER.length}
          </p>
          <p className="mt-0.5 text-[14px] font-bold leading-5 text-v3-navy" data-testid="newcomer-text">
            {NEWCOMER_STEPS[step].text}
          </p>
        </div>
      </div>
    </div>
  )
}
