// features/v2-guide/NewcomerCoach.tsx — พาคนใหม่ (ยังไม่มีบัญชี) หาธาตุฟรีก่อนสมัคร (เอ็ม 2026-10-14 "ร่างเลย แล้ว qi ค่อยได้หลังมีบัญชี")
// หน้าแนะนำ 4 หน้า → /v2/element-finder?newcomer=1 → บังคับกดทีละขั้น (แบบคลิป LINE): วันเกิด → เวลาเกิด → ดูธาตุ
// บังคับกด = หรี่จอ + กันแตะทุกที่ยกเว้นส่วนที่ส่อง (ผู้ใช้กดของจริงเอง) · ขั้นเลือกจากสถานะหน้า (newcomerStepFor — หน้าไม่เก็บขั้นเอง)
// วันเกิดที่กรอกจำไว้ให้หน้าสมัคร (/v2/register) เติมให้เอง ไม่ต้องกรอกซ้ำ · ยังไม่มี QI (ยังไม่มีบัญชี) — QI มาจากทัวร์หลังสมัคร
// ภาพ/การเคลื่อนไหวของช่องส่อง = Spotlight (ใช้ร่วมกับทัวร์แนะนำแอป) · ระหว่างคำนวณ (ไม่มีขั้น) ชั้นหายไป และไม่กลับมาอีก
// 🔴 ไกด์จบที่ปุ่มคำนวณ หน้าผลธาตุไม่มีขั้น (gafiw 2026-11-27 "พอคำนวณแล้วมันบังคับล็อกอินเลย · ไม่ขึ้นแสดงผล"):
//    ขั้น "signup" เดิมส่องแถว CTA สมัครฟรี → จอดำ 72% ทั้งหน้า wallpaper เลยมองไม่ออก กดสุ่ม/แชร์/บันทึกไม่ได้ ทางออกเดียวคือล็อกอิน
//    ตอนนี้ "สมัครฟรี ดูดวงเต็ม + รับ QI" เป็น CTA ธรรมดาของหน้าผล ผู้ใช้เลือกกดเอง — สมัครเป็นทางเลือก ไม่ใช่ประตู
import Link from "next/link"
import { useEffect, useState } from "react"

import { Spotlight, holeOf, useTrackedRect } from "@/features/v2-guide/Spotlight"

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

/** ล็อกอินแล้ว: ปิดไกด์คนใหม่ (หน้าหาธาตุกลับเป็นแบบปกติ) แต่เก็บวันเกิดไว้ให้หน้าสมัครเติม */
export function endNewcomerGuide() {
  try {
    window.sessionStorage.removeItem(FLAG)
  } catch {
    /* storage ปิด */
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
} satisfies Record<string, NewcomerStep>

export type NewcomerStepKey = keyof typeof NEWCOMER_STEPS

const ORDER: NewcomerStepKey[] = ["date", "time", "submit"]

/** สถานะหน้าหาธาตุที่ใช้เลือกขั้น — หน้าส่งมา หน้าไม่เก็บขั้นไกด์เอง */
export type FinderGuideState = { phase: "input" | "loading" | "result"; birthDate: string; canSubmit: boolean }

/**
 * ขั้นของไกด์จากสถานะหน้า — ของเดียวที่หน้าต้องถาม
 * ระหว่างคำนวณและหน้าผล = null: หน้าผลต้องโชว์เต็มจอ กดสุ่ม/แชร์/บันทึกได้ (สมัครฟรีเป็น CTA ธรรมดาของหน้า)
 */
export function newcomerStepFor(s: FinderGuideState): NewcomerStepKey | null {
  if (s.phase !== "input") return null
  return !s.birthDate ? "date" : !s.canSubmit ? "time" : "submit"
}

export function NewcomerCoach({ step }: { step: NewcomerStepKey | null }) {
  const rect = useTrackedRect(
    step,
    () => {
      const el = step ? document.querySelector<HTMLElement>(NEWCOMER_STEPS[step].target) : null
      return el && el.getBoundingClientRect().width > 0 ? [el] : []
    },
    (els) => els[0].scrollIntoView({ block: "center", behavior: "smooth" }),
  )

  if (!step || !rect) return null

  const vh = window.innerHeight
  const hole = holeOf(rect, PAD, vh)
  const below = hole.top + hole.height / 2 < vh / 2
  return (
    <Spotlight
      stepKey={step}
      hole={hole}
      mode="pass"
      testId="newcomer-coach"
      spotTestId="newcomer-spotlight"
      bubbleStyle={below ? { top: hole.top + hole.height + 16 } : { bottom: vh - hole.top + 16 }}
      bubble={
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={MASCOT} alt="เสี่ยวมู่" className="h-16 w-auto flex-none drop-shadow" />
          <div className="flex-1 rounded-[18px] bg-white p-3 shadow-lg">
            <p className="text-[11px] font-black text-v3-sapphire">
              {ORDER.indexOf(step) + 1}/{ORDER.length}
            </p>
            <p className="mt-0.5 text-[14px] font-bold leading-5 text-v3-navy" data-testid="newcomer-text">
              {NEWCOMER_STEPS[step].text}
            </p>
            {/* คนเก่าที่หลงมาทางคนใหม่: ทางออกไปเข้าสู่ระบบ (ไกด์บังคับกด ปุ่มอื่นในหน้ากดไม่ได้) */}
            <Link href="/v2/login" data-testid="newcomer-login" className="mt-1.5 inline-block text-[12px] font-semibold text-v3-sapphire underline">
              มีบัญชีแล้ว? เข้าสู่ระบบ
            </Link>
          </div>
        </>
      }
    />
  )
}
