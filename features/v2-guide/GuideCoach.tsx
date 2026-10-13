// features/v2-guide/GuideCoach.tsx — ไกด์ "ปุ่มพากด" ของเส้นทางมือใหม่ (mount ครั้งเดียวใน _app เฉพาะ /v2)
// มาจากไกด์ (?guide=<id>) → หรี่จอ + ไฮไลต์ปุ่มจริงทีละขั้น "กดตรงนี้" → ผู้ใช้กดปุ่มนั้นเอง = ไปขั้นต่อไป
// → ครบทุกขั้น = ผ่านเควส + บอก engine จ่าย QI (guide_<id>) + โชว์รางวัล. หาปุ่มไม่เจอใน 8 วิ → กล่องอธิบายแทน
import { useRouter } from "next/router"
import { useEffect, useRef, useState } from "react"

import { GUIDE_QUESTS, GUIDE_STEP_QI, GUIDE_TOTAL, missionIdOf, questForPath, type GuideQuest } from "@/features/v2-guide/quests"
import { reportGuideMission, useGuideProgress } from "@/features/v2-guide/useGuideProgress"

type Phase = "idle" | "searching" | "step" | "fallback" | "done"
type Rect = { top: number; left: number; width: number; height: number }

const MASCOT = "/images/v2/mascot/01-nav.png"
const FIND_TIMEOUT_MS = 8000

function findTarget(selectors: string[]): HTMLElement | null {
  for (const s of selectors) {
    const el = document.querySelector<HTMLElement>(s)
    if (el && el.getBoundingClientRect().width > 0) return el
  }
  return null
}

export function GuideCoach() {
  const router = useRouter()
  const { done, markDone } = useGuideProgress()
  const [quest, setQuest] = useState<GuideQuest | null>(null)
  const [stepIdx, setStepIdx] = useState(0)
  const [phase, setPhase] = useState<Phase>("idle")
  const [rect, setRect] = useState<Rect | null>(null)
  const [rewarded, setRewarded] = useState(false)
  const targetRef = useRef<HTMLElement | null>(null)

  // เริ่มไกด์เมื่อมาจากการ์ด (?guide=<id>) และอยู่หน้าของเควสนั้นจริง
  useEffect(() => {
    if (!router.isReady) return
    const fromGuide = typeof router.query.guide === "string" ? router.query.guide : null
    const here = questForPath(router.pathname)
    if (fromGuide && here && here.id === fromGuide) {
      setQuest(here)
      setStepIdx(0)
      setRewarded(false)
      setPhase("searching")
    } else {
      setQuest(null)
      setPhase("idle")
    }
  }, [router.isReady, router.pathname, router.query.guide])

  // หาปุ่มของขั้นปัจจุบัน (รอหน้าโหลด) → เลื่อนให้เห็น → ไฮไลต์
  useEffect(() => {
    if (phase !== "searching" || !quest) return
    const step = quest.steps[stepIdx]
    const started = Date.now()
    const id = window.setInterval(() => {
      const el = findTarget(step.target)
      if (el) {
        window.clearInterval(id)
        targetRef.current = el
        el.scrollIntoView({ block: "center", behavior: "smooth" })
        setPhase("step")
      } else if (Date.now() - started > FIND_TIMEOUT_MS) {
        window.clearInterval(id)
        setPhase("fallback")
      }
    }, 300)
    return () => window.clearInterval(id)
  }, [phase, quest, stepIdx])

  const complete = (q: GuideQuest) => {
    markDone(q.id)
    setRect(null)
    setPhase("done")
    void reportGuideMission(missionIdOf(q.id)).then((ok) => setRewarded(ok))
  }

  // ระหว่างไฮไลต์: ตามตำแหน่งปุ่ม (เลื่อนจอ/layout เปลี่ยน) + รอผู้ใช้กดปุ่มนั้น
  useEffect(() => {
    if (phase !== "step" || !quest) return
    const el = targetRef.current
    if (!el) return
    const track = () => {
      const r = el.getBoundingClientRect()
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height })
    }
    track()
    const tid = window.setInterval(track, 200)
    const isField = el.tagName === "TEXTAREA"
    const advance = () => {
      if (stepIdx + 1 < quest.steps.length) {
        setRect(null)
        setStepIdx(stepIdx + 1)
        setPhase("searching")
      } else {
        complete(quest)
      }
    }
    // ช่องพิมพ์ = ผ่านเมื่อเริ่มพิมพ์ · ปุ่ม/ช่องอื่น = ผ่านเมื่อแตะ
    const evt = isField ? "input" : "click"
    el.addEventListener(evt, advance, { once: true })
    return () => {
      window.clearInterval(tid)
      el.removeEventListener(evt, advance)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, quest, stepIdx])

  if (!quest || phase === "idle" || phase === "searching") return null

  const stop = () => { setPhase("idle"); setQuest(null); setRect(null) }
  const doneCount = GUIDE_QUESTS.filter((q) => done.includes(q.id)).length
  const next = GUIDE_QUESTS.find((q) => !done.includes(q.id) && q.id !== quest.id)
  const goNext = () => { stop(); void router.push(next ? `${next.href}?guide=${next.id}` : "/v2") }

  // ── ไฮไลต์ปุ่ม "กดตรงนี้" ──
  if (phase === "step" && rect) {
    const pad = 6
    const below = rect.top + rect.height < window.innerHeight * 0.6
    const step = quest.steps[stepIdx]
    return (
      <div className="pointer-events-none fixed inset-0 z-[70]" data-testid="guide-spotlight">
        {/* หรี่จอทั้งหมดยกเว้นปุ่มเป้าหมาย (box-shadow) — คลิกทะลุได้ ผู้ใช้กดปุ่มจริงเอง */}
        <div
          className="absolute rounded-[16px] border-[3px] border-v3-lime transition-all duration-200"
          style={{ top: rect.top - pad, left: rect.left - pad, width: rect.width + pad * 2, height: rect.height + pad * 2, boxShadow: "0 0 0 9999px rgba(10,22,52,0.6)" }}
        />
        <div
          className="absolute animate-ping rounded-[16px] border-2 border-v3-lime"
          style={{ top: rect.top - pad, left: rect.left - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 }}
        />
        <div
          className="pointer-events-auto absolute inset-x-0 mx-auto flex w-full max-w-md items-start gap-2 px-4"
          style={below ? { top: rect.top + rect.height + pad + 14 } : { bottom: window.innerHeight - rect.top + pad + 14 }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={MASCOT} alt="" aria-hidden className="h-16 w-auto flex-none drop-shadow" />
          <div className="flex-1 rounded-[18px] bg-white p-3 shadow-lg">
            <p className="text-[11px] font-black text-v3-sapphire">
              {quest.title}
              {quest.steps.length > 1 ? ` · ขั้น ${stepIdx + 1}/${quest.steps.length}` : ""}
            </p>
            <p className="mt-1 text-[14px] font-bold leading-5 text-v3-navy" data-testid="guide-step-text">
              {below ? "👆 " : "👇 "}
              {step.text}
            </p>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-[11px] font-bold text-[#8A5A0C]">ผ่านแล้วรับ +{GUIDE_STEP_QI} QI</span>
              <button type="button" onClick={stop} data-testid="guide-skip" className="text-[12px] font-bold text-v3-text-muted">
                ข้าม
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── หาปุ่มไม่เจอ (อธิบายแทน) / ทำครบแล้ว (รับรางวัล) ──
  const isDone = phase === "done"
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-28 z-[70] mx-auto flex w-full max-w-md justify-center px-4" data-testid="guide-coach">
      <div className="pointer-events-auto flex w-full items-end gap-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={MASCOT} alt="" aria-hidden className="h-20 w-auto flex-none drop-shadow" />
        <div className="relative flex-1 rounded-[18px] border border-v3-sapphire/20 bg-white p-3 shadow-lg">
          <p className="text-[11px] font-black text-v3-sapphire">เส้นทางมือใหม่ · {doneCount}/{GUIDE_TOTAL}</p>
          {isDone ? (
            <p className="mt-0.5 text-[15px] font-black text-v3-navy" data-testid="guide-reward">
              ภารกิจสำเร็จ! {rewarded ? `+${GUIDE_STEP_QI} QI 🎉` : "🎉"}
            </p>
          ) : (
            <p className="mt-0.5 text-[13px] font-bold text-v3-navy">{quest.title}</p>
          )}
          <p className="mt-1 text-[12px] leading-[18px] text-v3-text-body">{quest.coach}</p>
          <div className="mt-2 flex items-center justify-end gap-2">
            {isDone ? (
              <button type="button" data-testid="guide-coach-next" onClick={goNext} className="rounded-full bg-v3-sapphire px-3 py-1.5 text-[12px] font-bold text-v3-lime">
                {next ? "ภารกิจต่อไป →" : "กลับหน้าหลัก รับรางวัลจบ →"}
              </button>
            ) : (
              <button type="button" data-testid="guide-coach-ok" onClick={() => complete(quest)} className="rounded-full bg-v3-sapphire px-3 py-1.5 text-[12px] font-bold text-v3-lime">
                เข้าใจแล้ว
              </button>
            )}
            <button type="button" data-testid="guide-coach-close" onClick={stop} className="rounded-full border border-v3-border-card px-3 py-1.5 text-[12px] font-bold text-v3-navy">
              ปิด
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
