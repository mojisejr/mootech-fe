// features/v2-qi/components/LineOaCard.tsx — แอด LINE OA รับ 100 ชี่ (ครั้งเดียว · Kittipon 2026-11-18)
// 1) กดแอดไลน์ → เปิด OA  2) กลับมากด "รับ 100 Qi" → /api/v2/line-oa-claim เช็กเพื่อนกับ LINE แล้วจ่าย
import { useState } from "react"

export const LINE_OA_URL = "https://lin.ee/nfnvqFU"

export function LineOaCard({ onClaimed }: { onClaimed?: () => void }) {
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const claim = async () => {
    if (busy) return
    setBusy(true)
    setMsg(null)
    try {
      const r = await fetch("/api/v2/line-oa-claim", { method: "POST" })
      const d = (await r.json().catch(() => ({}))) as { awarded?: boolean; capped?: boolean; earnedQi?: number; message?: string }
      if (r.ok && d.capped) setMsg({ ok: true, text: "คุณรับรางวัลแอดไลน์ไปแล้ว" })
      else if (r.ok) {
        setMsg({ ok: true, text: `รับ +${typeof d.earnedQi === "number" && d.earnedQi > 0 ? d.earnedQi : 100} Qi เรียบร้อย! ขอบคุณที่เป็นเพื่อนกับ Mumate` })
        onClaimed?.()
      } else setMsg({ ok: false, text: d.message ?? `รับไม่สำเร็จ (รหัส ${r.status})` })
    } catch {
      setMsg({ ok: false, text: "เชื่อมต่อไม่ได้ ลองใหม่อีกครั้ง" })
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="rounded-[20px] bg-white p-5 v3-shadow-card" data-testid="line-oa-card">
      <div className="flex items-center gap-3">
        <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[#06C755] text-[13px] font-black text-white">LINE</div>
        <div>
          <p className="text-[16px] font-bold leading-6 text-v3-navy">แอดไลน์ Mumate รับ +100 Qi</p>
          <p className="text-[12px] leading-[18px] text-v3-text-muted">ไม่พลาดดวงรายวัน โปรฯ และข่าวใหม่ · รับได้ครั้งเดียว</p>
        </div>
      </div>
      <div className="mt-4 flex gap-3">
        <a href={LINE_OA_URL} target="_blank" rel="noopener noreferrer" data-testid="line-oa-add"
          className="flex-1 rounded-full bg-[#06C755] px-4 py-2.5 text-center text-sm font-semibold text-white">
          1. แอดไลน์
        </a>
        <button type="button" onClick={claim} disabled={busy} data-testid="line-oa-claim"
          className="flex-1 rounded-full bg-v3-sapphire px-4 py-2.5 text-sm font-semibold text-v3-lime disabled:opacity-60">
          {busy ? "กำลังเช็ก…" : "2. รับ 100 Qi"}
        </button>
      </div>
      {msg && <p className={"mt-2 text-[12px] font-bold " + (msg.ok ? "text-v3-qi-earn" : "text-v3-error")} data-testid="line-oa-msg">{msg.text}</p>}
    </section>
  )
}
