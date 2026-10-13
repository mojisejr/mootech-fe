// features/v2-guide/useGuideProgress.ts — ความคืบหน้า "เส้นทางมือใหม่" เก็บในเครื่อง (localStorage)
// ทุกคอมโพเนนต์ที่ใช้ hook นี้ sync กันผ่าน event (เปลี่ยนหน้าแล้วการ์ดหน้าหลักอัปเดตทันที)
// storage ปิด/เสีย = ไกด์ยังใช้ได้ แค่ไม่จำ (ไม่ทำให้หน้าพัง)
import { useCallback, useEffect, useState } from "react"

const KEY = "mumate-guide-v1"
const EVENT = "mumate-guide-change"

export type GuideState = { done: string[]; hidden: boolean }
const EMPTY: GuideState = { done: [], hidden: false }

function read(): GuideState {
  if (typeof window === "undefined") return EMPTY
  try {
    const raw = window.localStorage.getItem(KEY)
    if (!raw) return EMPTY
    const j = JSON.parse(raw) as Partial<GuideState>
    return { done: Array.isArray(j.done) ? j.done.filter((x): x is string => typeof x === "string") : [], hidden: j.hidden === true }
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
  const reset = useCallback(() => write(EMPTY), [])

  return { ...state, ready, markDone, setHidden, reset }
}
