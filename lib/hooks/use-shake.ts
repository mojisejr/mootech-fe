// เขย่ามือถือ → เรียก onShake (เซียมซีโป๊ยเซียน 2026-11-03). iOS 13+ ต้องขอสิทธิ์ motion จากการแตะ 1 ครั้ง → requestPermission()
import { useCallback, useEffect, useRef, useState } from "react"

type MotionCtor = { requestPermission?: () => Promise<"granted" | "denied"> }
const THRESHOLD = 18 // m/s² ส่วนต่างความเร่งระหว่างเฟรม — เดินปกติไม่ถึง เขย่าแรง ๆ ถึง
const GAP_MS = 1500

export function useShake(onShake: () => void, enabled: boolean) {
  const cb = useRef(onShake)
  cb.current = onShake
  const [supported, setSupported] = useState(false)
  const [needsPermission, setNeedsPermission] = useState(false)
  const [granted, setGranted] = useState(false)

  useEffect(() => {
    if (typeof window === "undefined" || !("DeviceMotionEvent" in window)) return
    const touch = navigator.maxTouchPoints > 0
    setSupported(touch)
    const ctor = window.DeviceMotionEvent as unknown as MotionCtor
    if (typeof ctor.requestPermission === "function") setNeedsPermission(true)
    else setGranted(touch)
  }, [])

  const requestPermission = useCallback(async () => {
    const ctor = window.DeviceMotionEvent as unknown as MotionCtor
    try {
      const r = await ctor.requestPermission?.()
      setGranted(r === "granted")
      setNeedsPermission(r !== "granted")
    } catch {
      setNeedsPermission(true)
    }
  }, [])

  useEffect(() => {
    if (!enabled || !granted) return
    let last: { x: number; y: number; z: number } | null = null
    let lastFire = 0
    const onMotion = (e: DeviceMotionEvent) => {
      const a = e.accelerationIncludingGravity
      if (!a || a.x == null || a.y == null || a.z == null) return
      const cur = { x: a.x, y: a.y, z: a.z }
      if (last) {
        const d = Math.abs(cur.x - last.x) + Math.abs(cur.y - last.y) + Math.abs(cur.z - last.z)
        const now = Date.now()
        if (d > THRESHOLD && now - lastFire > GAP_MS) {
          lastFire = now
          cb.current()
        }
      }
      last = cur
    }
    window.addEventListener("devicemotion", onMotion)
    return () => window.removeEventListener("devicemotion", onMotion)
  }, [enabled, granted])

  return { supported, needsPermission, granted, requestPermission }
}
