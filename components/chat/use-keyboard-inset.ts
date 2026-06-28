// Tracks how many px the on-screen keyboard overlaps the layout viewport bottom, via the
// VisualViewport API (#mootech-chat-mobile-ux, Phase 3). The full-screen chat lifts its composer
// by this amount so the input + send button never hide behind the mobile keyboard — the root
// cause of the "กดส่งไม่ไป" production bug. Returns 0 on desktop / unsupported / no keyboard.
import { useEffect, useState } from "react"

export function useKeyboardInset(): number {
  const [inset, setInset] = useState(0)

  useEffect(() => {
    if (typeof window === "undefined") return
    const vv = window.visualViewport
    if (!vv) return

    const update = () => {
      // overlap = layout-viewport height minus the visible (visual) viewport bottom edge.
      const overlap = window.innerHeight - vv.height - vv.offsetTop
      setInset(overlap > 1 ? Math.round(overlap) : 0)
    }

    update()
    vv.addEventListener("resize", update)
    vv.addEventListener("scroll", update)
    return () => {
      vv.removeEventListener("resize", update)
      vv.removeEventListener("scroll", update)
    }
  }, [])

  return inset
}
