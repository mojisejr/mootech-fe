// features/v2-shop/components/PlanShareInvite.tsx — บล็อก "แชร์ให้เพื่อนเลย!" บนหน้าชำระเงินสำเร็จ (Promo B).
//
// โชว์เฉพาะคนที่เข้าเกณฑ์ (ใช้ MUMATE100 + จ่ายสำเร็จ) — GET /api/v2/promo/share-code:
//   { eligible:false }                    → ไม่โชว์อะไร (ซื้อปกติ ไม่ได้ร่วมโปร)
//   { eligible:true, code, used, max }    → โชว์โค้ด + เหลืออีกกี่คน + ปุ่มแชร์
// เพื่อนกดลิงก์ → /promo/free-month?code=... (ล็อกอินแล้วกดรับ Pro ฟรี 1 เดือน).
import { useEffect, useState } from 'react'

type ShareState = { eligible: true; code: string; used: number; max: number } | { eligible: false } | null

export function PlanShareInvite() {
  const [state, setState] = useState<ShareState>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let alive = true
    fetch('/api/v2/promo/share-code')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (alive && j && typeof j.eligible === 'boolean') setState(j) })
      .catch(() => {})
    return () => { alive = false }
  }, [])

  // ยังไม่รู้ผล หรือไม่เข้าเกณฑ์ → ไม่โชว์บล็อกนี้
  if (!state || state.eligible !== true) return null

  const { code, used, max } = state
  const remaining = Math.max(0, max - used)
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const redeemUrl = `${origin}/promo/free-month?code=${encodeURIComponent(code)}`
  const shareText = `ได้ Mumate Pro ฟรี 1 เดือน! กดรับด้วยโค้ดของฉัน ${code} ที่ ${redeemUrl}`

  const flash = () => { setCopied(true); window.setTimeout(() => setCopied(false), 2000) }
  const copy = async () => { await navigator.clipboard?.writeText(shareText).catch(() => {}); flash() }
  const share = () => {
    if (typeof navigator !== 'undefined' && navigator.share) void navigator.share({ text: shareText, url: redeemUrl }).catch(() => {})
    else void copy()
  }

  return (
    <section data-testid="plan-share-invite" className="v3-shadow-card flex w-full flex-col items-center gap-3 rounded-[22px] bg-white p-5 text-center">
      <p className="text-lg font-bold leading-6 text-v3-sapphire">🎉 ยินดีด้วย!</p>
      <p className="text-sm leading-[22px] text-v3-text-body">
        แชร์โค้ดให้เพื่อน ใช้ <b className="text-v3-navy">Mumate Pro ฟรี 1 เดือน</b>
        <br />
        <span className="text-v3-text-muted">เหลืออีก {remaining} คน (สูงสุด {max} คน)</span>
      </p>

      <div className="flex w-full items-center gap-2 rounded-2xl bg-v3-ghost-white px-4 py-3">
        <span className="min-w-0 flex-1 truncate text-left text-base font-black tracking-wider text-v3-navy" data-testid="plan-share-code">{code}</span>
        <button type="button" onClick={() => void copy()} className="flex-none rounded-full bg-v3-sapphire px-3.5 py-2 text-[10px] font-black uppercase text-v3-lime" data-testid="plan-share-copy">
          {copied ? 'คัดลอกแล้ว' : 'คัดลอก'}
        </button>
      </div>

      <div className="flex w-full flex-col gap-2">
        <button
          type="button"
          onClick={share}
          disabled={remaining === 0}
          className="grid h-[52px] w-full place-items-center rounded-full bg-v3-lime text-[15px] font-black text-v3-sapphire disabled:opacity-50"
          data-testid="plan-share-cta"
        >
          {remaining === 0 ? 'ครบ 10 คนแล้ว' : 'แชร์ให้เพื่อนเลย!'}
        </button>
        {remaining > 0 && (
          <a href={`https://line.me/R/msg/text/?${encodeURIComponent(shareText)}`} target="_blank" rel="noreferrer"
            className="grid h-11 w-full place-items-center rounded-full border border-v3-border-dropdown text-[14px] font-bold text-v3-navy" data-testid="plan-share-line">
            แชร์ผ่าน LINE
          </a>
        )}
      </div>
    </section>
  )
}

export default PlanShareInvite
