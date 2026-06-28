// Locks document.body scroll while the chat is open (#mootech-chat-mobile-ux, Phase 3).
// The old modal had no scroll-lock → the page behind a full-screen sheet could scroll-bleed /
// rubber-band on mobile. Restores the prior style on close/unmount.
import { useEffect } from "react"

export function useBodyScrollLock(active: boolean): void {
  useEffect(() => {
    if (!active || typeof document === "undefined") return
    const body = document.body
    const prevOverflow = body.style.overflow
    const prevTouch = body.style.touchAction
    body.style.overflow = "hidden"
    body.style.touchAction = "none"
    return () => {
      body.style.overflow = prevOverflow
      body.style.touchAction = prevTouch
    }
  }, [active])
}
