// features/v2-shop/components/PlanShareInvite.tsx — บล็อก "แชร์ให้เพื่อนเลย!" บนหน้าชำระเงินสำเร็จ
// (โปรฯ Mumate Pro ลด 90% — ฟิว/ซินแส 2026-09-28). ดีไซน์ตาม mockup: ยินดีด้วย → แชร์โค้ดให้เพื่อน
// ใช้ Pro ฟรี 1 เดือน (สูงสุด 10 คน) → ปุ่ม "แชร์ให้เพื่อนเลย!".
//
// 🔴 หมายเหตุ backend (รอเอ็มเคาะ): โค้ดนี้ reuse โค้ดชวนเพื่อนเดิม (/api/referral) ซึ่ง "ตอนนี้แจกเป็น QI".
// การจะให้เพื่อนที่กรอกโค้ดได้ "Pro ฟรี 1 เดือน" จริง + เพดาน 10 คน/แอค & 1000 สิทธิ์รวม เป็นงาน backend
// แยก (campaign grant) ที่ยังไม่ได้ต่อสายในไฟล์นี้ — ส่วนนี้คือ UX/หน้าตาการแชร์ตาม mockup.
import { useEffect, useState } from 'react'

const MAX_FRIENDS = 10

export function PlanShareInvite() {
  const [code, setCode] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let alive = true
    fetch('/api/referral')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (alive && j?.code) setCode(String(j.code)) })
      .catch(() => {})
    return () => { alive = false }
  }, [])

  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const inviteUrl = code ? `${origin}/invite/${code}` : ''
  const shareText = code ? `ได้ Mumate Pro ฟรี 1 เดือน! ใช้โค้ดของฉัน ${code} สมัครที่ ${inviteUrl}` : ''

  const flash = () => { setCopied(true); window.setTimeout(() => setCopied(false), 2000) }
  const copy = async () => { if (!code) return; await navigator.clipboard?.writeText(shareText).catch(() => {}); flash() }
  const share = () => {
    if (!code) return
    if (typeof navigator !== 'undefined' && navigator.share) {
      void navigator.share({ text: shareText, url: inviteUrl }).catch(() => {})
    } else {
      void copy()
    }
  }

  return (
    <section
      data-testid="plan-share-invite"
      className="v3-shadow-card flex w-full flex-col items-center gap-3 rounded-[22px] bg-white p-5 text-center"
    >
      <p className="text-lg font-bold leading-6 text-v3-sapphire">🎉 ยินดีด้วย!</p>
      <p className="text-sm leading-[22px] text-v3-text-body">
        แชร์โค้ดให้เพื่อน ใช้ <b className="text-v3-navy">Mumate Pro ฟรี 1 เดือน</b>
        <br />
        <span className="text-v3-text-muted">*สูงสุด {MAX_FRIENDS} คน*</span>
      </p>

      {/* กล่องโค้ด + คัดลอก */}
      <div className="flex w-full items-center gap-2 rounded-2xl bg-v3-ghost-white px-4 py-3">
        <span className="min-w-0 flex-1 truncate text-left text-base font-black tracking-wider text-v3-navy" data-testid="plan-share-code">
          {code ?? '······'}
        </span>
        <button
          type="button"
          onClick={() => void copy()}
          disabled={!code}
          className="flex-none rounded-full bg-v3-sapphire px-3.5 py-2 text-[10px] font-black uppercase text-v3-lime disabled:opacity-50"
          data-testid="plan-share-copy"
        >
          {copied ? 'คัดลอกแล้ว' : 'คัดลอก'}
        </button>
      </div>

      <div className="flex w-full flex-col gap-2">
        <button
          type="button"
          onClick={share}
          disabled={!code}
          className="grid h-[52px] w-full place-items-center rounded-full bg-v3-lime text-[15px] font-black text-v3-sapphire disabled:opacity-50"
          data-testid="plan-share-cta"
        >
          แชร์ให้เพื่อนเลย!
        </button>
        <a
          href={code ? `https://line.me/R/msg/text/?${encodeURIComponent(shareText)}` : undefined}
          target="_blank"
          rel="noreferrer"
          aria-disabled={!code}
          className={`grid h-11 w-full place-items-center rounded-full border border-v3-border-dropdown text-[14px] font-bold text-v3-navy ${code ? '' : 'pointer-events-none opacity-50'}`}
          data-testid="plan-share-line"
        >
          แชร์ผ่าน LINE
        </a>
      </div>
    </section>
  )
}

export default PlanShareInvite
