// features/v2-qi/components/QiSpendSheets.tsx — ชีตคู่ของการใช้ชี่ (ก้อน 1.5):
//   SpendConfirmSheet   — "ยืนยันใช้ N ชี่" ก่อนยิง POST /api/qi-spend (frame `spend-confirm-sheet`)
//   InsufficientQiSheet — ชี่ไม่พอ: โชว์ขาอีกเท่าไร + ทางสะสม (frame `insufficient-qi-sheet`)
// ราคา/ชื่อสิทธิ์ทุกตัวมาจาก catalog ของ engine — จอไม่เดาราคาเอง.
// 409 จาก engine = แต้มไม่พอ → เปิด InsufficientQiSheet; 5xx = ระบบล้ม (engine refund แต้มเองแล้ว)
//   → ข้อความต้องบอกว่า "แต้มไม่หาย" เพราะ engine auto-refund ให้ก่อนตอบ error.
import Link from "next/link"
import { useState } from "react"

import type { QiSpendLine } from "../qi-model"

const X_CLOSE = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="m6 6 12 12M18 6 6 18" /></svg>
)

function SheetShell({ label, onClose, children }: { label: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-t-[28px] bg-white p-6 pb-10 font-ibm"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={label}
      >
        <div className="mb-2 flex items-center justify-end">
          <button type="button" aria-label="ปิด" onClick={onClose} className="grid size-8 place-items-center rounded-full text-v3-text-muted hover:bg-v3-ghost-white">
            {X_CLOSE}
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function SpendConfirmSheet({
  line,
  balance,
  onClose,
  onSpent,
  onInsufficient,
}: {
  line: QiSpendLine
  balance: number
  onClose: () => void
  /** แลกสำเร็จ — ส่งยอดชี่ล่าสุดที่ engine ตอบกลับมาให้ parent อัปเดต wallet */
  onSpent: (qiLeft: number) => void
  /** engine ตอบ 409 (แต้มไม่พอ) — parent เปลี่ยนไปเปิด InsufficientQiSheet */
  onInsufficient: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState<string | null>(null)
  const short = Math.max(0, line.qi - balance)

  const confirm = async () => {
    setBusy(true)
    setFailed(null)
    try {
      const res = await fetch("/api/qi-spend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: line.code }),
      })
      const j = (await res.json().catch(() => ({}))) as { qi?: number; error?: string }
      if (res.ok) {
        onSpent(typeof j.qi === "number" ? j.qi : balance - line.qi)
        return
      }
      if (res.status === 409) {
        onInsufficient()
        return
      }
      // 5xx — engine refund แต้มเองก่อนตอบ error แต้มของผู้ใช้ไม่หาย บอกตรง ๆ กัน panic
      setFailed(res.status >= 500 ? "ระบบขัดข้องชั่วคราว — แต้มของคุณไม่หาย ลองอีกครั้งภายหลัง" : String(j.error ?? "แลกสิทธิ์ไม่สำเร็จ"))
    } catch {
      setFailed("เชื่อมต่อไม่สำเร็จ — ลองอีกครั้ง")
    } finally {
      setBusy(false)
    }
  }

  return (
    <SheetShell label="ยืนยันการใช้ชี่" onClose={onClose}>
      <div className="flex flex-col items-center gap-1 py-2 text-center">
        <p className="text-[13px] font-bold text-v3-text-muted">ยืนยันการใช้ชี่</p>
        <h2 className="text-[18px] font-bold leading-7 text-v3-navy" data-testid="qi-spend-title">{line.title}</h2>
        <p className="max-w-xs text-[13px] leading-5 text-v3-text-body">{line.note}</p>
        <p className="mt-2 text-[15px] font-black text-v3-navy" data-testid="qi-spend-price">
          ใช้ {line.qi} ชี่ <span className="text-[12px] font-bold text-v3-text-muted">(คงเหลือ {Math.max(0, balance - line.qi)} ชี่)</span>
        </p>
      </div>
      {failed && (
        <p className="mt-2 text-center text-[12px] font-bold text-v3-error" data-testid="qi-spend-failed">{failed}</p>
      )}
      <div className="mt-4 flex flex-col gap-2">
        <button
          onClick={() => void confirm()}
          disabled={busy || short > 0}
          data-testid="qi-spend-confirm"
          className="grid h-12 w-full place-items-center rounded-full bg-v3-cyan text-base font-bold text-white disabled:opacity-40"
        >
          {busy ? "กำลังแลก..." : `ยืนยันใช้ ${line.qi} ชี่`}
        </button>
        <button onClick={onClose} className="grid h-11 w-full place-items-center rounded-full border border-v3-border-card text-sm font-bold text-v3-navy">
          ยกเลิก
        </button>
      </div>
    </SheetShell>
  )
}

export function InsufficientQiSheet({
  line,
  balance,
  onClose,
}: {
  line: QiSpendLine
  balance: number
  onClose: () => void
}) {
  const short = Math.max(0, line.qi - balance)
  return (
    <SheetShell label="ชี่ไม่พอ" onClose={onClose}>
      <div className="flex flex-col items-center gap-1 py-2 text-center">
        <p className="text-[13px] font-bold text-v3-text-muted">ชี่ของคุณไม่พอ</p>
        <h2 className="text-[18px] font-bold leading-7 text-v3-navy" data-testid="qi-insufficient-title">{line.title}</h2>
        <p className="mt-1 text-[14px] leading-6 text-v3-text-body" data-testid="qi-insufficient-short">
          ต้องใช้ {line.qi} ชี่ — ตอนนี้มี {balance} ชี่ ขาอีก {short} ชี่
        </p>
        <p className="max-w-xs text-[12px] leading-5 text-v3-text-muted">
          สะสมเพิ่มได้จากเช็คอินรายวัน ทำภารกิจ และชวนเพื่อน
        </p>
      </div>
      <div className="mt-4 flex flex-col gap-2">
        <Link
          href="/v2/qi/missions"
          data-testid="qi-insufficient-missions"
          className="grid h-12 w-full place-items-center rounded-full bg-v3-cyan text-base font-bold text-white"
        >
          ไปทำภารกิจสะสมชี่
        </Link>
        {/* buy-qi (ก้อน 1.6) — ทางเลือกที่สอง: ซื้อแพ็กชี่ (ตามมีตติ้ง: CTA พาคนไม่อยากทำภารกิจไปหน้าจ่าย) */}
        <Link
          href="/v2/qi/buy"
          data-testid="qi-insufficient-buy"
          className="grid h-11 w-full place-items-center rounded-full border border-v3-border-card text-sm font-bold text-v3-navy"
        >
          ซื้อแพ็กชี่
        </Link>
        <button onClick={onClose} className="grid h-11 w-full place-items-center rounded-full text-sm font-bold text-v3-text-muted">
          ไว้ก่อน
        </button>
      </div>
    </SheetShell>
  )
}
