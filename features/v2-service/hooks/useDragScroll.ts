// #Bug2 — ทำให้ carousel "ปัดขวาได้" แน่นอนบนมือถือ. เดิมพึ่ง native overflow-x touch-scroll ล้วน ซึ่งบางเครื่อง
// ปัดแล้วไม่เลื่อน. วิธีนี้คุมการเลื่อนแนวนอนด้วย JS เอง ผ่าน pointer events:
//   • ตั้ง touchAction: 'pan-y' → เบราว์เซอร์ยังจัดการ "เลื่อนหน้าแนวตั้ง" ตามปกติ แต่ปล่อยแนวนอนมาให้เรา
//   • ลากแนวนอน → set scrollLeft เอง · ปล่อยแล้ว snap ไปการ์ดที่ใกล้สุด
//   • แตะเฉยๆ (ไม่ลากเกิน threshold) → ปล่อย click ผ่านไปหา <Link>/ปุ่มตามเดิม (ไม่พังการแตะ)
import { useCallback, useRef } from "react"

const DRAG_THRESHOLD = 6 // px — ต่ำกว่านี้ถือเป็น "แตะ" ไม่ใช่ "ลาก"

export function useDragScroll<T extends HTMLElement>() {
  const ref = useRef<T | null>(null)
  const st = useRef({ down: false, startX: 0, startLeft: 0, moved: false })

  const onPointerDown = useCallback((e: React.PointerEvent<T>) => {
    const el = ref.current
    if (!el) return
    st.current = { down: true, startX: e.clientX, startLeft: el.scrollLeft, moved: false }
  }, [])

  const onPointerMove = useCallback((e: React.PointerEvent<T>) => {
    const el = ref.current
    const s = st.current
    if (!el || !s.down) return
    const dx = e.clientX - s.startX
    if (!s.moved && Math.abs(dx) > DRAG_THRESHOLD) {
      s.moved = true
      try { el.setPointerCapture(e.pointerId) } catch { /* ไม่รองรับก็ข้าม */ }
    }
    if (s.moved) el.scrollLeft = s.startLeft - dx
  }, [])

  const end = useCallback(() => {
    const el = ref.current
    const s = st.current
    if (!el || !s.down) return
    s.down = false
    if (!s.moved) return
    // snap ไปการ์ดที่ใกล้สุด (เลียนแบบ snap-center) หลังปล่อยนิ้ว
    let best = el.scrollLeft
    let bestD = Infinity
    for (const child of Array.from(el.children) as HTMLElement[]) {
      const target = child.offsetLeft - (el.clientWidth - child.clientWidth) / 2
      const d = Math.abs(target - el.scrollLeft)
      if (d < bestD) { bestD = d; best = target }
    }
    el.scrollTo({ left: Math.max(0, best), behavior: "smooth" })
  }, [])

  // ลากแล้วอย่าให้กลายเป็นคลิก (กันเผลอกดเข้าไปหน้า manifest ตอนตั้งใจปัด)
  const onClickCapture = useCallback((e: React.MouseEvent<T>) => {
    if (st.current.moved) {
      e.preventDefault()
      e.stopPropagation()
      st.current.moved = false
    }
  }, [])

  return {
    ref,
    dragHandlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: end,
      onPointerLeave: end,
      onPointerCancel: end,
      onClickCapture,
      style: { touchAction: "pan-y" as const },
    },
  }
}
