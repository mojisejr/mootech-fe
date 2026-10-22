// features/v2-privacy/AiTrainingAsk.tsx — ป็อปอัปถามสมาชิกเดิม "ครั้งเดียว" ในหน้าแชท (เอ็ม 2026-10-22)
// ยังไม่เคยตอบ ai_training → ถาม · ตอบแล้ว (ยินยอมหรือไม่) = ไม่ถามอีก · ยังไม่ล็อกอิน = ไม่ถาม
// ตอบไว้รุ่นเดิม → ถามอีกครั้งเดียว พร้อมบอกว่าเพิ่มอะไร (รุ่น 2026-10.2 เพิ่มการวิเคราะห์เพื่อพัฒนาบริการ)
// "ไว้ก่อน" ไม่บันทึก แต่จำในเครื่องไว้ไม่ให้เด้งซ้ำ (เปลี่ยนใจได้ที่ ตั้งค่า › จัดการความยินยอม)
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { AI_TRAINING_ASKED_KEY, AI_TRAINING_SUB, aiTrainingAnswer, recordAiTrainingConsent } from './aiTraining'

export function AiTrainingAsk() {
  const [open, setOpen] = useState(false)
  const [again, setAgain] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let alive = true
    try {
      if (window.localStorage.getItem(AI_TRAINING_ASKED_KEY)) return
    } catch {
      /* storage ปิด → ถามตาม server */
    }
    void aiTrainingAnswer().then((answer) => {
      if (!alive || (answer !== 'never' && answer !== 'old')) return
      setAgain(answer === 'old')
      setOpen(true)
    })
    return () => {
      alive = false
    }
  }, [])

  const close = () => {
    try {
      window.localStorage.setItem(AI_TRAINING_ASKED_KEY, '1')
    } catch {
      /* ไม่เป็นไร */
    }
    setOpen(false)
  }
  const answer = async (accepted: boolean) => {
    setBusy(true)
    await recordAiTrainingConsent(accepted)
    setBusy(false)
    close()
  }

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-6" role="dialog" aria-modal="true" aria-label="ช่วยพัฒนาเสี่ยวมู่">
      <button type="button" aria-label="ปิด" onClick={close} className="absolute inset-0 bg-black/40" />
      <div className="relative w-full max-w-xs rounded-3xl bg-white p-6 text-center shadow-xl" data-testid="ai-training-ask">
        <div className="mx-auto grid size-14 place-items-center rounded-full bg-v3-lime/25 text-3xl">🤝</div>
        <p className="mt-3 text-lg font-bold leading-7 text-v3-navy">ช่วยให้เสี่ยวมู่ทายแม่นขึ้นไหม?</p>
        {again ? (
          <p className="mt-1.5 text-sm leading-5 text-v3-text-muted" data-testid="ai-training-again">
            เราเพิ่มการใช้คำถามเพื่อดูว่าสมาชิกสนใจเรื่องไหน จึงขอถามคุณอีกครั้ง
          </p>
        ) : null}
        <p className="mt-1.5 text-sm leading-5 text-v3-text-muted">ยินยอมให้เราใช้คำถามที่คุณถาม AI เพื่อพัฒนาความแม่นยำและบริการ</p>
        <p className="mt-2 text-xs leading-[18px] text-v3-text-muted">{AI_TRAINING_SUB}</p>
        <div className="mt-5 flex gap-3">
          <button
            type="button"
            disabled={busy}
            onClick={() => void answer(false)}
            data-testid="ai-training-no"
            className="flex-1 rounded-full border border-v3-sapphire px-4 py-2.5 text-sm font-semibold text-v3-sapphire"
          >
            ไม่ยินยอม
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void answer(true)}
            data-testid="ai-training-yes"
            className="flex-1 rounded-full bg-v3-sapphire px-4 py-2.5 text-sm font-semibold text-v3-lime"
          >
            ยินยอม
          </button>
        </div>
        <p className="mt-3 text-[11px] leading-4 text-v3-text-muted">
          เปลี่ยนใจได้ทุกเมื่อที่{' '}
          <Link href="/v2/privacy/consent" className="underline">
            จัดการความยินยอม
          </Link>
        </p>
      </div>
    </div>
  )
}
