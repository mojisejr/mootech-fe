// features/v2-guide/OnboardingTour.tsx — ทัวร์แนะนำแอป 8 ขั้น (coach mark แบบ LINE · สเปก FTUE เอ็ม 2026-10-14) mount ครั้งเดียวใน _app เฉพาะ /v2
// ขึ้นเองเมื่อเปิดหน้าหลักครั้งแรกหลังล็อกอิน (ยังไม่เคยจบ/ข้าม · engine ยังไม่จ่าย guide_tour · ยังไม่จบเส้นทางมือใหม่)
// หรี่จอ + ส่องส่วนที่แนะนำ + มือชี้ + เสี่ยวมู่พูด · แตะส่วนที่ส่อง หรือ "ถัดไป" = ขั้นต่อไป (ระหว่างทัวร์แตะแล้วไม่ออกจากหน้า)
// เปลี่ยนหน้าเอง (หน้าหลัก → บริการ → โปรไฟล์) · หาส่วนที่ส่องไม่เจอใน 6 วิ = ข้ามขั้นนั้น (ไม่ค้างจอมืด)
// "เริ่มต้นใช้งาน" = จบ + engine จ่าย TOUR_QI ครั้งเดียว · "ไว้คราวหลัง" = ปิด ไม่ได้รางวัล · ทั้งคู่จำไว้ ไม่ขึ้นซ้ำ
import { useRouter } from "next/router"
import { useEffect, useState } from "react"

import { TOUR_MISSION_ID, TOUR_QI, TOUR_STEPS } from "@/features/v2-guide/tourSteps"
import { reportGuideMission } from "@/features/v2-guide/useGuideProgress"

const KEY = "mumate-tour-v1"
const EVENT = "mumate-tour-change"
const MASCOT = "/images/v2/mascot/01-nav.png"
const FIND_TIMEOUT_MS = 6000
const START_DELAY_MS = 900
const PAD = 10

type Rect = { top: number; left: number; width: number; height: number }

function tourSeen(): boolean {
  try {
    return window.localStorage.getItem(KEY) != null
  } catch {
    return false
  }
}

function setActiveFlag(on: boolean) {
  if (on) document.documentElement.dataset.tour = "on"
  else delete document.documentElement.dataset.tour
  window.dispatchEvent(new Event(EVENT))
}

/** ทัวร์กำลังเล่นอยู่ไหม — ป็อปอัปอื่น (โปรฯ เช็กอิน/ประกาศ) ใช้หลบไม่ให้บังส่วนที่ส่อง */
export function useTourActive(): boolean {
  const [on, setOn] = useState(false)
  useEffect(() => {
    const sync = () => setOn(document.documentElement.dataset.tour === "on")
    sync()
    window.addEventListener(EVENT, sync)
    return () => window.removeEventListener(EVENT, sync)
  }, [])
  return on
}

/** ส่วนที่ส่องทุกอันที่เจอ — อันแรกต้องมี ไม่งั้นถือว่ายังไม่โผล่ */
function findTargets(selectors: string[]): HTMLElement[] {
  const visible = (el: HTMLElement | null): el is HTMLElement => !!el && el.getBoundingClientRect().width > 0
  const first = document.querySelector<HTMLElement>(selectors[0])
  if (!visible(first)) return []
  return [first, ...selectors.slice(1).map((s) => document.querySelector<HTMLElement>(s)).filter(visible)]
}

function unionRect(els: HTMLElement[]): Rect {
  const rs = els.map((el) => el.getBoundingClientRect())
  const top = Math.min(...rs.map((r) => r.top))
  const left = Math.min(...rs.map((r) => r.left))
  const bottom = Math.max(...rs.map((r) => r.bottom))
  const right = Math.max(...rs.map((r) => r.right))
  return { top, left, width: right - left, height: bottom - top }
}

/** ภารกิจ engine บอกว่าเคยจบทัวร์ (อีกเครื่อง) หรือจบเส้นทางมือใหม่แล้ว → ไม่ต้องทัวร์ · ล็อกอินไม่ผ่าน = ไม่ทัวร์ */
async function shouldStartFromServer(): Promise<boolean> {
  try {
    const r = await fetch("/api/missions")
    if (!r.ok) return false
    const j = (await r.json()) as { missions?: Array<{ id?: string; completed?: boolean; claimedAt?: string | null }> }
    const rows = Array.isArray(j.missions) ? j.missions : []
    return !rows.some((m) => (m.id === TOUR_MISSION_ID || m.id === "guide_complete") && (m.claimedAt || m.completed))
  } catch {
    return false
  }
}

export function OnboardingTour() {
  const router = useRouter()
  const [step, setStep] = useState<number | null>(null)
  const [rect, setRect] = useState<Rect | null>(null)
  const [reward, setReward] = useState<string | null>(null)

  const realPath = (router.asPath || router.pathname).split(/[?#]/)[0]

  // เริ่มเอง: หน้าหลัก + ไม่ได้มาจากไกด์เควส + ยังไม่เคยเห็น
  useEffect(() => {
    if (!router.isReady || step !== null || realPath !== "/v2" || router.query.guide) return
    if (tourSeen()) return
    let alive = true
    const delay = new Promise((resolve) => setTimeout(resolve, START_DELAY_MS))
    void Promise.all([shouldStartFromServer(), delay]).then(([ok]) => {
      if (!alive || !ok || tourSeen()) return
      setStep(0)
      setActiveFlag(true)
    })
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.isReady, realPath, router.query.guide])

  const end = (how: "done" | "skipped") => {
    try {
      window.localStorage.setItem(KEY, how)
    } catch {
      /* storage ปิด */
    }
    setStep(null)
    setRect(null)
    setActiveFlag(false)
  }

  const finish = () => {
    end("done")
    setReward("จบทัวร์แล้ว!")
    void reportGuideMission(TOUR_MISSION_ID).then((ok) => {
      if (ok) setReward(`จบทัวร์แล้ว! รับ +${TOUR_QI} QI 🎉`)
    })
  }

  const next = () => {
    if (step === null) return
    setRect(null)
    if (step + 1 >= TOUR_STEPS.length) finish()
    else setStep(step + 1)
  }

  // ขั้นปัจจุบัน: อยู่ผิดหน้า → พาไป · รอส่วนที่ส่องโผล่ → เลื่อนให้เห็น → ตามตำแหน่งทุก 200ms
  useEffect(() => {
    if (step === null) return
    const s = TOUR_STEPS[step]
    if (realPath !== s.page) {
      setRect(null)
      void router.push(s.page)
      return
    }
    const started = Date.now()
    let scrolled = false
    const id = window.setInterval(() => {
      const els = findTargets(s.targets)
      if (els.length === 0) {
        if (Date.now() - started > FIND_TIMEOUT_MS) {
          window.clearInterval(id)
          next()
        }
        return
      }
      if (!scrolled) {
        scrolled = true
        els[0].scrollIntoView({ block: "center", behavior: "smooth" })
      }
      setRect(unionRect(els))
    }, 200)
    return () => window.clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, realPath])

  useEffect(() => {
    if (!reward) return
    const t = window.setTimeout(() => setReward(null), 3500)
    return () => window.clearTimeout(t)
  }, [reward])

  if (step === null) {
    if (!reward) return null
    return (
      <div className="pointer-events-none fixed inset-x-0 top-6 z-[80] flex justify-center px-4" data-testid="tour-reward">
        <p className="rounded-full bg-v3-sapphire px-4 py-2 text-[14px] font-black text-v3-lime shadow-lg">{reward}</p>
      </div>
    )
  }

  const s = TOUR_STEPS[step]
  const last = step === TOUR_STEPS.length - 1
  const vh = typeof window === "undefined" ? 800 : window.innerHeight
  const hole = rect
    ? (() => {
        const top = Math.max(rect.top - PAD, 4)
        const bottom = Math.min(rect.top + rect.height + PAD, vh - 4)
        return { top, left: rect.left - PAD, width: rect.width + PAD * 2, height: Math.max(bottom - top, 0) }
      })()
    : null
  // กล่องคำพูด: วางฝั่งที่เหลือที่มากกว่า · ส่วนที่ส่องสูงจนไม่มีที่ = ชิดล่างจอ
  const spaceBelow = hole ? vh - (hole.top + hole.height) : 0
  const spaceAbove = hole ? hole.top : 0
  const bubbleStyle: React.CSSProperties =
    !hole || Math.max(spaceBelow, spaceAbove) < 220
      ? { bottom: "calc(16px + env(safe-area-inset-bottom))" }
      : spaceBelow >= spaceAbove
        ? { top: hole.top + hole.height + 14 }
        : { bottom: vh - hole.top + 14 }

  // แตะในส่วนที่ส่อง = ถัดไป · แตะที่อื่นไม่มีผล (ฉากกันทั้งจอ — ระหว่างทัวร์ไม่ออกจากหน้า)
  const onScrim = (e: React.MouseEvent) => {
    if (!hole) return
    const { clientX: x, clientY: y } = e
    if (x >= hole.left && x <= hole.left + hole.width && y >= hole.top && y <= hole.top + hole.height) next()
  }

  return (
    <div className="fixed inset-0 z-[80]" data-testid="onboarding-tour" onClick={onScrim}>
      {hole ? (
        <>
          <div
            className="pointer-events-none absolute rounded-[18px] border-2 border-white/80 transition-all duration-300"
            style={{ ...hole, boxShadow: "0 0 0 9999px rgba(0,0,0,0.72), 0 0 18px 4px rgba(255,255,255,0.55)" }}
            data-testid="tour-spotlight"
          />
          <span
            aria-hidden
            className="pointer-events-none absolute animate-bounce text-[40px] drop-shadow-lg"
            style={{ top: hole.top + hole.height * 0.55, left: hole.left + Math.max(hole.width * 0.7 - 20, 0) }}
          >
            👆
          </span>
        </>
      ) : (
        <div className="pointer-events-none absolute inset-0 bg-black/[0.72]" />
      )}

      <div className="absolute inset-x-0 mx-auto flex w-full max-w-md items-end gap-2 px-4" style={bubbleStyle} onClick={(e) => e.stopPropagation()}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={MASCOT} alt="เสี่ยวมู่" className="h-20 w-auto flex-none drop-shadow" />
        <div className="flex-1 rounded-[18px] bg-white p-3 shadow-lg" data-testid="tour-bubble">
          <p className="text-[11px] font-black text-v3-sapphire" data-testid="tour-progress">
            {step + 1}/{TOUR_STEPS.length}
          </p>
          <p className="mt-0.5 text-[15px] font-black leading-5 text-v3-navy" data-testid="tour-title">
            {s.title}
          </p>
          <p className="mt-1 text-[13px] leading-[19px] text-v3-text-body">{s.body}</p>
          <div className="mt-2.5 flex items-center justify-between">
            <button type="button" onClick={() => end("skipped")} data-testid="tour-skip" className="text-[12px] font-bold text-v3-text-muted underline">
              ไว้คราวหลัง
            </button>
            <button
              type="button"
              onClick={next}
              data-testid={last ? "tour-finish" : "tour-next"}
              className="rounded-full bg-v3-sapphire px-4 py-1.5 text-[13px] font-bold text-v3-lime"
            >
              {last ? `เริ่มต้นใช้งาน (+${TOUR_QI} QI)` : "ถัดไป"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
