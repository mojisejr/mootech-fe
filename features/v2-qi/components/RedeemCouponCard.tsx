// features/v2-qi/components/RedeemCouponCard.tsx — ช่องกรอกโค้ดคูปองกิจกรรม (#2 Phase 2 · ซินแสนุ้ย 2026-09-14).
// user กรอกโค้ด → /api/coupon-redeem → engine มอบรางวัล (QI/เครดิตแชท·เปิดไพ่/tier). กันรับซ้ำ 1 คูปอง/บัญชี (ฝั่ง engine).
import { useState } from "react"

export function RedeemCouponCard({ onRedeemed }: { onRedeemed?: () => void }) {
  const [code, setCode] = useState("")
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const submit = async () => {
    const c = code.trim()
    if (!c || busy) return
    setBusy(true)
    setMsg(null)
    try {
      const r = await fetch("/api/coupon-redeem", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: c }) })
      const d = (await r.json().catch(() => ({}))) as { ok?: boolean; reward?: string; message?: string; reason?: string }
      if (r.ok && d.ok) {
        setMsg({ ok: true, text: `รับ ${d.reward} เรียบร้อย!` })
        setCode("")
        onRedeemed?.()
      } else {
        setMsg({ ok: false, text: d.message ?? d.reason ?? "ใช้โค้ดไม่สำเร็จ" })
      }
    } catch {
      setMsg({ ok: false, text: "เชื่อมต่อไม่ได้ ลองใหม่อีกครั้ง" })
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="v3-shadow-card rounded-[16px] bg-white p-4" data-testid="qi-redeem-coupon">
      <p className="text-[15px] font-bold text-v3-navy">🎟️ กรอกโค้ดคูปอง</p>
      <p className="mt-0.5 text-[12px] leading-[18px] text-v3-text-body">มีโค้ดกิจกรรม? กรอกรับ QI / เครดิตแชท / สิทธิ์พิเศษ (โค้ดละครั้งต่อบัญชี)</p>
      <div className="mt-2.5 flex gap-2">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          onKeyDown={(e) => { if (e.key === "Enter") void submit() }}
          placeholder="เช่น SONGKRAN"
          aria-label="โค้ดคูปอง"
          className="min-w-0 flex-1 rounded-full border border-v3-divider bg-white px-4 py-2.5 text-sm font-bold uppercase tracking-wide text-v3-navy placeholder:font-normal placeholder:tracking-normal placeholder:text-v3-text-muted focus:border-v3-sapphire focus:outline-none"
        />
        <button
          type="button"
          onClick={() => void submit()}
          disabled={busy || !code.trim()}
          data-testid="qi-redeem-btn"
          className="grid h-11 flex-none place-items-center rounded-full bg-v3-sapphire px-5 text-sm font-bold text-white disabled:opacity-50"
        >
          {busy ? "…" : "ใช้โค้ด"}
        </button>
      </div>
      {msg && <p className={"mt-2 text-[12px] font-bold " + (msg.ok ? "text-v3-qi-earn" : "text-v3-error")} data-testid="qi-redeem-msg">{msg.text}</p>}
    </section>
  )
}
