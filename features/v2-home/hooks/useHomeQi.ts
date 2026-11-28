// features/v2-home/hooks/useHomeQi.ts — ยอดชีสำหรับชิป QI บนหน้าหลัก (Home v3 รอบแรก · ประชุม 24 พ.ย. 2569 ข้อ 1)
// undefined = ยังไม่รู้ (กำลังโหลด → บล็อกเทา) · null = อ่านไม่ได้ (ไม่โชว์ชิป — ไม่โชว์ 0 ปลอม) · number = ยอดจริงจากกระเป๋า
import { useEffect, useState } from 'react'

export function useHomeQi(enabled: boolean): number | null | undefined {
  const [qi, setQi] = useState<number | null | undefined>(undefined)

  // Idempotent effect (alive guard, no latch): ยิงหลัง user row มาแล้วเท่านั้น — ระหว่าง mint identity
  // (คนกลับจาก LINE ค้าง 'loading' ได้ ~17 วิ) endpoint ตอบ 401 จะกลายเป็น "อ่านไม่ได้" โดยไม่ควร
  useEffect(() => {
    if (!enabled) return
    let alive = true
    void (async () => {
      try {
        const res = await fetch('/api/qi-wallet?history=0')
        const j = (await res.json().catch(() => null)) as { qi?: unknown } | null
        if (!alive) return
        setQi(res.ok && typeof j?.qi === 'number' && Number.isFinite(j.qi) ? j.qi : null)
      } catch {
        if (alive) setQi(null)
      }
    })()
    return () => {
      alive = false
    }
  }, [enabled])

  return qi
}
