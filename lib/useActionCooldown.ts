// lib/useActionCooldown.ts — คูลดาวน์ทั่วไปกันบอทยิงรัว/กดรัว บนปุ่ม action ที่เปลืองโควตา/QI/LLM.
// ต่างจาก useCalcCooldown (คู่ดวง, 60 วิ, ผูก userId) — อันนี้ทั่วไป default 10 วิ ผูกด้วย scope string.
//
// กติกา: begin() คืน true แค่ครั้งแรก (ล็อก firing ทันที = กันดับเบิลคลิกในเฟรมเดียว) + เริ่มคูลดาวน์;
// ยิงซ้ำระหว่าง firing หรือระหว่างคูลดาวน์ = คืน false. end() ปลดล็อก firing (คูลดาวน์เดินต่อจนครบ).
// deadline เก็บ localStorage → อยู่รอด remount/navigate; storage เสีย = degrade เป็นไม่มีคูลดาวน์ (ปุ่มไม่ตาย).
import { useCallback, useEffect, useRef, useState } from 'react'

export const DEFAULT_COOLDOWN_MS = 10_000

function keyOf(scope: string): string { return `mm:cooldown:${scope || 'default'}` }

function readLastAt(scope: string): number {
  if (typeof window === 'undefined') return 0
  try {
    const raw = window.localStorage.getItem(keyOf(scope))
    const n = raw ? Number(raw) : 0
    return Number.isFinite(n) && n > 0 && n <= Date.now() ? n : 0
  } catch { return 0 }
}
function remainingFrom(lastAt: number, ms: number): number {
  if (!lastAt) return 0
  return Math.max(0, ms - (Date.now() - lastAt))
}

export type ActionCooldown = {
  secondsLeft: number
  active: boolean
  /** เรียกตอนกดปุ่ม: คืน true ถ้าได้ไปต่อ (พร้อมล็อก+เริ่มคูลดาวน์), false ถ้าถูกกัน */
  begin: () => boolean
  /** เรียกใน finally หลัง action จบ: ปลดล็อก firing (คูลดาวน์ยังเดินต่อ) */
  end: () => void
}

export function useActionCooldown(scope: string, ms: number = DEFAULT_COOLDOWN_MS): ActionCooldown {
  const [msLeft, setMsLeft] = useState(0)
  const firingRef = useRef(false)

  useEffect(() => { setMsLeft(remainingFrom(readLastAt(scope), ms)) }, [scope, ms])
  useEffect(() => {
    if (msLeft <= 0) return
    const id = setInterval(() => setMsLeft(remainingFrom(readLastAt(scope), ms)), 250)
    return () => clearInterval(id)
  }, [msLeft, scope, ms])

  const begin = useCallback((): boolean => {
    if (firingRef.current) return false
    if (remainingFrom(readLastAt(scope), ms) > 0) return false
    firingRef.current = true
    const now = Date.now()
    try { if (typeof window !== 'undefined') window.localStorage.setItem(keyOf(scope), String(now)) } catch { /* ignore */ }
    setMsLeft(ms)
    return true
  }, [scope, ms])

  const end = useCallback(() => { firingRef.current = false }, [])

  return { secondsLeft: Math.ceil(msLeft / 1000), active: msLeft > 0, begin, end }
}
