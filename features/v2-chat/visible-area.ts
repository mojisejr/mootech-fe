// features/v2-chat/visible-area.ts — where the chat screen must sit while the on-screen keyboard is open
// (mumate-chat-keyboard-ios-001).
//
// iOS (Safari, the installed PWA, and LINE's WKWebView) does NOT shrink the page for the keyboard: it shrinks
// the *visual* viewport and pans it down to the focused input, so `visualViewport.offsetTop` > 0. The old
// #chat-vh code (PR #638, written for a Samsung white gap) set only the height to `visualViewport.height` and
// left the screen at the top of the document — the shrunk screen then sat ABOVE what the user sees, and the
// uncoloured page canvas showed white between it and the keyboard. Pinning needs both: top AND height.
//
// The text-size setting (pages/v2/settings → `html.style.zoom` 0.9 / 1.1 / 1.25) is the second trap:
// visualViewport reports unzoomed px, but a px length set on an element under `zoom` is multiplied by it.
// Measured 2026-10-03 in Chromium and WebKit 26.5 (393×852): height = vv.height at zoom 0.9 covered 767 px
// (85 px band below), at 1.25 it was 1065 px (composer off-screen). Dividing by the zoom covers exactly 852.
//
// Where offsetTop is 0 and zoom is 1 (Android Chrome, Samsung Internet, desktop) the result equals the old
// height-only code, so the Samsung fix still holds.
import { useEffect, useState } from 'react'

export type VisibleArea = { top: number; height: number }

type ViewportLike = { height: number; offsetTop: number }

/** CSS px (in the zoomed coordinate space the element is laid out in) of the area the user can see. */
export function visibleArea(vv: ViewportLike, zoom: number): VisibleArea {
  const z = Number.isFinite(zoom) && zoom > 0 ? zoom : 1
  return {
    top: Math.max(0, Math.round(vv.offsetTop / z)),
    height: Math.round(vv.height / z),
  }
}

/** The zoom the text-size setting puts on <html>; 1 when unset or unreadable. */
export function rootZoom(): number {
  try {
    const raw = window.getComputedStyle(document.documentElement).zoom || document.documentElement.style.zoom
    const z = Number.parseFloat(raw)
    return Number.isFinite(z) && z > 0 ? z : 1
  } catch {
    return 1
  }
}

/** Live visible area; null before the first measurement or where visualViewport does not exist. */
export function useVisibleArea(): VisibleArea | null {
  const [area, setArea] = useState<VisibleArea | null>(null)
  useEffect(() => {
    const vv = typeof window !== 'undefined' ? window.visualViewport : null
    if (!vv) return
    const apply = () => {
      const next = visibleArea(vv, rootZoom())
      setArea((prev) => (prev && prev.top === next.top && prev.height === next.height ? prev : next))
    }
    apply()
    vv.addEventListener('resize', apply)
    vv.addEventListener('scroll', apply)
    return () => {
      vv.removeEventListener('resize', apply)
      vv.removeEventListener('scroll', apply)
    }
  }, [])
  return area
}

/** While mounted, paint the page canvas in `color` so any gap the viewport math cannot close is not white. */
export function useCanvasColor(color: string): void {
  useEffect(() => {
    const html = document.documentElement
    const previous = html.style.backgroundColor
    html.style.backgroundColor = color
    return () => {
      html.style.backgroundColor = previous
    }
  }, [color])
}
