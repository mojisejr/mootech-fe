// features/v2-guide/OnboardingTour.tsx — ทัวร์แนะนำแอป 12 ขั้น (coach mark แบบ LINE · สเปก FTUE เอ็ม 2026-10-14) mount ครั้งเดียวใน _app เฉพาะ /v2
// ขึ้นเองเมื่อเปิดหน้าหลักครั้งแรกหลังล็อกอิน (ยังไม่เคยจบ/ข้าม · engine ยังไม่จ่าย guide_tour · ยังไม่จบเส้นทางมือใหม่)
// หรี่จอ + ส่องส่วนที่แนะนำ + มือชี้ + เสี่ยวมู่พูด · แตะส่วนที่ส่อง หรือ "ถัดไป" = ขั้นต่อไป (ระหว่างทัวร์แตะแล้วไม่ออกจากหน้า)
// เปลี่ยนหน้า = ขั้น nav: ส่องปุ่มเมนู ผู้ใช้กดของจริงเอง (ถึงหน้า to = ขั้นต่อไป) · หาปุ่มเมนูไม่เจอ 6 วิ = พาไปเอง
// หาส่วนที่ส่องขั้นอื่นไม่เจอใน 6 วิ = ข้ามขั้นนั้น (ไม่ค้างจอมืด)
// "เริ่มต้นใช้งาน" = จบ + engine จ่าย TOUR_QI ครั้งเดียว · "ไว้คราวหลัง" = ปิด ไม่ได้รางวัล · ทั้งคู่จำไว้ ไม่ขึ้นซ้ำ
// ภาพ/การเคลื่อนไหวของช่องส่อง = Spotlight (ใช้ร่วมกับไกด์คนใหม่)
import { useRouter } from "next/router"
import { useEffect, useRef, useState } from "react"

import { Spotlight, holeOf, useTrackedRect } from "@/features/v2-guide/Spotlight"
import { TOUR_MISSION_ID, TOUR_QI, TOUR_STEPS } from "@/features/v2-guide/tourSteps"
import { reportGuideMission } from "@/features/v2-guide/useGuideProgress"

const KEY = "mumate-tour-v1"
const EVENT = "mumate-tour-change"
const MASCOT = "/images/v2/mascot/01-nav.png"
const FIND_TIMEOUT_MS = 6000
const START_DELAY_MS = 900
const PAD = 10

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
  const [reward, setReward] = useState<string | null>(null)

  const realPath = (router.asPath || router.pathname).split(/[?#]/)[0]
  const s = step === null ? null : TOUR_STEPS[step]
  const onPage = !!s && realPath === s.page

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

  // ขั้น nav: ผู้ใช้กดเมนูจนถึงหน้าปลายทาง = ขั้นต่อไป · อยู่ผิดหน้า (หลง/รีเฟรช) → พากลับหน้าของขั้นนี้
  const arrivedNav = !!s && s.kind === "nav" && realPath === s.to
  useEffect(() => {
    if (!s) return
    if (arrivedNav) next()
    else if (!onPage) void router.push(s.page)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, onPage, arrivedNav])

  const end = (how: "done" | "skipped") => {
    try {
      window.localStorage.setItem(KEY, how)
    } catch {
      /* storage ปิด */
    }
    setStep(null)
    setActiveFlag(false)
  }

  const finish = () => {
    end("done")
    setReward("จบทัวร์แล้ว!")
    void reportGuideMission(TOUR_MISSION_ID).then((ok) => {
      if (ok) setReward(`จบทัวร์แล้ว! รับ +${TOUR_QI} QI 🎉`)
    })
  }

  const stepRef = useRef(step)
  stepRef.current = step
  const next = () => {
    const cur = stepRef.current
    if (cur === null) return
    if (cur + 1 >= TOUR_STEPS.length) finish()
    else setStep(cur + 1)
  }

  // ตามตำแหน่งทุกเฟรม · เจอครั้งแรก = เลื่อนให้เห็น · หาไม่เจอเกิน 6 วิ = ข้ามขั้น
  const startedAt = useRef(0)
  useEffect(() => {
    startedAt.current = Date.now()
  }, [step, onPage])
  const rect = useTrackedRect(
    onPage ? step : null,
    () => (s ? findTargets(s.targets) : []),
    (els) => els[0].scrollIntoView({ block: "center", behavior: "smooth" }),
    (found) => {
      if (!found && Date.now() - startedAt.current > FIND_TIMEOUT_MS) {
        startedAt.current = Date.now()
        if (s?.kind === "nav" && s.to) void router.push(s.to) // ไม่เจอปุ่มเมนู → พาไปเอง (ถึงแล้วขั้นต่อไปเอง)
        else next()
      }
    },
  )

  useEffect(() => {
    if (!reward) return
    const t = window.setTimeout(() => setReward(null), 3500)
    return () => window.clearTimeout(t)
  }, [reward])

  if (step === null || !s) {
    if (!reward) return null
    return (
      <div className="pointer-events-none fixed inset-x-0 top-6 z-[80] flex justify-center px-4" data-testid="tour-reward">
        <p className="rounded-full bg-v3-sapphire px-4 py-2 text-[14px] font-black text-v3-lime shadow-lg">{reward}</p>
      </div>
    )
  }

  const last = step === TOUR_STEPS.length - 1
  const nav = s.kind === "nav"
  const vh = typeof window === "undefined" ? 800 : window.innerHeight
  const hole = rect && onPage ? holeOf(rect, PAD, vh) : null
  // กล่องคำพูด: วางฝั่งที่เหลือที่มากกว่า · ส่วนที่ส่องสูงจนไม่มีที่ = ชิดล่างจอ
  const spaceBelow = hole ? vh - (hole.top + hole.height) : 0
  const spaceAbove = hole ? hole.top : 0
  const bubbleStyle: React.CSSProperties =
    !hole || Math.max(spaceBelow, spaceAbove) < 220
      ? { bottom: "calc(16px + env(safe-area-inset-bottom))" }
      : spaceBelow >= spaceAbove
        ? { top: hole.top + hole.height + 14 }
        : { bottom: vh - hole.top + 14 }

  return (
    <Spotlight
      stepKey={step}
      hole={hole}
      mode={nav ? "pass" : "catch"}
      onHoleTap={nav ? undefined : next}
      testId="onboarding-tour"
      spotTestId="tour-spotlight"
      bubbleStyle={bubbleStyle}
      bubble={
        <>
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
              {nav ? (
                <span className="text-[12px] font-bold text-v3-sapphire" data-testid="tour-tap-hint">แตะปุ่มที่ส่องอยู่ 👆</span>
              ) : (
              <button
                type="button"
                onClick={next}
                data-testid={last ? "tour-finish" : "tour-next"}
                className="rounded-full bg-v3-sapphire px-4 py-1.5 text-[13px] font-bold text-v3-lime"
              >
                {last ? `เริ่มต้นใช้งาน (+${TOUR_QI} QI)` : "ถัดไป"}
              </button>
              )}
            </div>
          </div>
        </>
      }
    />
  )
}
