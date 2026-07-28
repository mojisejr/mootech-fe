// MuMate v2 — ปฏิทินดวง · useAdvancedMode (goo · CLIENT-TRUTH toggle).
// ฟีม: "โหมดแอดวานซ์เปิดไว้เป็นค่าเริ่มต้น แต่ต้อง toggle ได้จริง" → default ON, real 2-way toggle.
// The default is a CONSTANT (true) → same on server + client → hydration-safe, no fence needed. (This
// is the "toggle group" from the goo⇄Lamun seam: constant default = safe by construction.)
import { useCallback, useState } from 'react'

export interface UseAdvancedMode {
  /** true = โหมดแอดวานซ์ (บล็อก 4 เสา visible). Default ON (ฟีม). */
  advanced: boolean
  toggle: () => void
  set: (on: boolean) => void
}

export function useAdvancedMode(defaultOn = true): UseAdvancedMode {
  const [advanced, setAdvanced] = useState<boolean>(defaultOn)
  const toggle = useCallback(() => setAdvanced((v) => !v), [])
  const set = useCallback((on: boolean) => setAdvanced(on), [])
  return { advanced, toggle, set }
}
