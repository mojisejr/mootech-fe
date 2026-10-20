// features/v2-shell/hooks/useCardGate.tsx — ด่านก่อนเปิดไพ่/เซียมซี/เบอร์มงคล (โควตา card ก้อนเดียวกัน)
// guard(run): เช็คสิทธิ์ครั้งถัดไป (/api/v2/card-quota, ไม่หัก) — ฟรี/เครดิต/สมาชิกไม่จำกัด → ทำเลย
//   ครั้งนี้จะหัก QI (สิทธิ์ฟรีวันนี้หมด) หรือ QI ไม่พอ → ป็อปอัป "อยากดูแบบไม่จำกัด?" (ดูแพ็กเกจ / ใช้ QI / ไว้ก่อน)
// blocked(): engine ตอบ 402 (แข่งกันหมดพอดี) → ป็อปอัปแบบ QI ไม่พอ
// เช็คล้ม → ปล่อยทำต่อ (engine ยังตัดสิทธิ์จริงอยู่ — ด่านนี้คือ UX ไม่ใช่ประตูเงิน)
import { useState, type ReactNode } from "react"

import { UnlimitedUpsellModal } from "@/features/v2-shell/components/UnlimitedUpsellModal"

type Pending = { affordable: boolean; cost: number; run?: () => void }

export function useCardGate(): { guard: (run: () => void) => Promise<void>; blocked: () => void; modal: ReactNode } {
  const [pending, setPending] = useState<Pending | null>(null)

  const guard = async (run: () => void) => {
    try {
      const r = await fetch("/api/v2/card-quota")
      const q = r.ok ? ((await r.json()) as { nextSource?: string | null; cost?: number; affordable?: boolean }) : null
      if (!q || q.nextSource === "free" || q.nextSource === "credit" || (q.nextSource == null && q.affordable !== false)) {
        run()
        return
      }
      setPending({ affordable: q.affordable !== false && q.nextSource === "qi", cost: q.cost || 10, run })
    } catch {
      run()
    }
  }

  const blocked = () => setPending({ affordable: false, cost: 10 })

  const modal = pending ? (
    <UnlimitedUpsellModal
      affordable={pending.affordable}
      cost={pending.cost}
      onUseQi={pending.run ? () => { const go = pending.run; setPending(null); go?.() } : undefined}
      onClose={() => setPending(null)}
    />
  ) : null

  return { guard, blocked, modal }
}
