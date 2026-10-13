// features/v2-guide/useGuideProgress.ts — ความคืบหน้า "เส้นทางมือใหม่"
// แหล่งจริง = ภารกิจ engine (guide_<id> รับรางวัลแล้ว = ผ่าน → ข้ามเครื่องได้) · localStorage = แคชให้จอขึ้นทันที
// ทุกคอมโพเนนต์ที่ใช้ hook นี้ sync กันผ่าน event · storage/เน็ตเสีย = ไกด์ยังใช้ได้ ไม่ทำให้หน้าพัง
import { useCallback, useEffect, useState } from "react"

import { GUIDE_QUESTS, missionIdOf } from "@/features/v2-guide/quests"

const KEY = "mumate-guide-v1"
const EVENT = "mumate-guide-change"

export type GuideState = { done: string[]; hidden: boolean; bonus: boolean }
const EMPTY: GuideState = { done: [], hidden: false, bonus: false }

function read(): GuideState {
  if (typeof window === "undefined") return EMPTY
  try {
    const raw = window.localStorage.getItem(KEY)
    if (!raw) return EMPTY
    const j = JSON.parse(raw) as Partial<GuideState>
    return {
      done: Array.isArray(j.done) ? j.done.filter((x): x is string => typeof x === "string") : [],
      hidden: j.hidden === true,
      bonus: j.bonus === true,
    }
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
    const claimed = new Set(rows.filter((m) => m.completed || m.claimedAt).map((m) => m.id))
    const cur = read()
    const done = new Set(cur.done)
    for (const q of GUIDE_QUESTS) if (claimed.has(missionIdOf(q.id))) done.add(q.id)
    const bonus = cur.bonus || claimed.has("guide_complete")
    if (done.size !== cur.done.length || bonus !== cur.bonus) write({ ...cur, done: Array.from(done), bonus })
  } catch {
    /* ออฟไลน์ */
  }
}

/** บอก engine ว่าผ่านขั้นนี้ → engine จ่าย QI ครั้งเดียว. คืน true ถ้าได้รางวัลรอบนี้ */
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
  const setBonus = useCallback(() => write({ ...read(), bonus: true }), [])

  return { ...state, ready, markDone, setHidden, setBonus }
}
