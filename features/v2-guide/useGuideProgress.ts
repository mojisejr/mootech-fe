// features/v2-guide/useGuideProgress.ts — ความคืบหน้า "เส้นทางมือใหม่"
// แหล่งจริง = ภารกิจ engine (guide_* ที่รับรางวัลแล้ว → ข้ามเครื่องได้) · localStorage = แคชให้จอขึ้นทันที
// ทุกคอมโพเนนต์ที่ใช้ hook นี้ sync กันผ่าน event · storage/เน็ตเสีย = ไกด์ยังใช้ได้ ไม่ทำให้หน้าพัง
import { useCallback, useEffect, useState } from "react"

import { GUIDE_CHAPTERS, GUIDE_QUESTS, chapterBonusId, missionIdOf } from "@/features/v2-guide/quests"

const KEY = "mumate-guide-v1"
const EVENT = "mumate-guide-change"

/** done = เควสที่ผ่าน · bonuses = โบนัสที่รับแล้ว (guide_ch<n> / guide_complete) */
export type GuideState = { done: string[]; hidden: boolean; bonuses: string[] }
const EMPTY: GuideState = { done: [], hidden: false, bonuses: [] }

const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [])

function read(): GuideState {
  if (typeof window === "undefined") return EMPTY
  try {
    const raw = window.localStorage.getItem(KEY)
    if (!raw) return EMPTY
    const j = JSON.parse(raw) as Partial<GuideState> & { bonus?: boolean }
    // รุ่นแรกเก็บ bonus:boolean (โบนัสจบเดียว) → แปลงเป็น guide_complete
    const bonuses = strings(j.bonuses)
    if (j.bonus === true && !bonuses.includes("guide_complete")) bonuses.push("guide_complete")
    return { done: strings(j.done), hidden: j.hidden === true, bonuses }
  } catch {
    return EMPTY
  }
}

function write(next: GuideState) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    /* storage ปิด */
  }
  window.dispatchEvent(new Event(EVENT))
}

type MissionRow = { id?: string; completed?: boolean; claimedAt?: string | null }

/** ดึงภารกิจจาก engine แล้วรวมเข้ากับที่เครื่องจำไว้ (ผ่านที่เครื่องอื่นก็นับ) */
export async function syncGuideFromServer(): Promise<void> {
  try {
    const r = await fetch("/api/missions")
    if (!r.ok) return
    const j = (await r.json()) as { missions?: MissionRow[] }
    const rows = Array.isArray(j.missions) ? j.missions : []
    const claimed = new Set(rows.filter((m) => m.claimedAt || m.completed).map((m) => m.id))
    const cur = read()
    const done = new Set(cur.done)
    for (const q of GUIDE_QUESTS) if (claimed.has(missionIdOf(q.id))) done.add(q.id)
    const bonuses = new Set(cur.bonuses)
    for (const c of GUIDE_CHAPTERS) if (claimed.has(chapterBonusId(c.id))) bonuses.add(chapterBonusId(c.id))
    if (claimed.has("guide_complete")) bonuses.add("guide_complete")
    if (done.size !== cur.done.length || bonuses.size !== cur.bonuses.length) {
      write({ ...cur, done: Array.from(done), bonuses: Array.from(bonuses) })
    }
  } catch {
    /* ออฟไลน์ */
  }
}

/** บอก engine ว่าผ่านภารกิจ/ขอรับโบนัส → engine จ่าย QI ครั้งเดียว. คืน true ถ้าได้รางวัลรอบนี้ */
export async function reportGuideMission(missionId: string): Promise<boolean> {
  try {
    const r = await fetch("/api/missions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ missionId }),
    })
    if (!r.ok) return false
    const j = (await r.json().catch(() => ({}))) as { rewarded?: boolean }
    return j.rewarded === true
  } catch {
    return false
  }
}

export function useGuideProgress() {
  // render แรกฝั่ง client = ค่าว่างเหมือน SSR (กัน hydration mismatch) แล้วค่อยอ่านจริงหลัง mount
  const [state, setState] = useState<GuideState>(EMPTY)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const sync = () => setState(read())
    sync()
    setReady(true)
    window.addEventListener(EVENT, sync)
    window.addEventListener("storage", sync)
    return () => {
      window.removeEventListener(EVENT, sync)
      window.removeEventListener("storage", sync)
    }
  }, [])

  const markDone = useCallback((id: string) => {
    const cur = read()
    if (cur.done.includes(id)) return
    write({ ...cur, done: [...cur.done, id] })
  }, [])

  const setHidden = useCallback((hidden: boolean) => write({ ...read(), hidden }), [])
  const addBonus = useCallback((id: string) => {
    const cur = read()
    if (!cur.bonuses.includes(id)) write({ ...cur, bonuses: [...cur.bonuses, id] })
  }, [])

  return { ...state, ready, markDone, setHidden, addBonus }
}

/** บทที่กำลังทำ: บทแรกที่ยังไม่จบ (ยังมีเควสค้าง หรือยังไม่รับโบนัสบท) · บทถัดไปล็อกจนบทนี้ทำเควสครบ */
export function guideStatus(done: string[], bonuses: string[]) {
  const chapters = GUIDE_CHAPTERS.map((c, i) => {
    const doneCount = c.quests.filter((q) => done.includes(q.id)).length
    const complete = doneCount === c.quests.length
    const prevComplete = i === 0 || GUIDE_CHAPTERS[i - 1].quests.every((q) => done.includes(q.id))
    return { chapter: c, index: i, doneCount, complete, unlocked: prevComplete, bonusClaimed: bonuses.includes(chapterBonusId(c.id)) }
  })
  const current = chapters.find((c) => !c.complete || !c.bonusClaimed) ?? null
  const allQuestsDone = chapters.every((c) => c.complete)
  return { chapters, current, allQuestsDone, finalClaimed: bonuses.includes("guide_complete") }
}
