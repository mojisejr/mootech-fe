// features/v2-shop/components/QrScreen.tsx — the PromptPay wait (mootech-fe#363).
//
// 🔴 NOT IN THE DESIGN AT ALL. The Figma file has no QR screen and no PromptPay anything, so every word here
// was written by me rather than translated. That makes this screen the highest-risk copy in the ticket: there
// is no frame to diff it against, and the per-line audit (DoD) is the only thing that reads it. Every visible
// string is therefore a named constant below, so the audit has one place to enumerate instead of a hunt.
//
// 🔴 WHAT THIS SCREEN MAY NEVER SAY. It may not say the payment succeeded unless /payment/status reports
// APPROVED for THIS chargeId, and it may not say the QR expired — because nothing tells us that (the gateway
// forwards only the QR image; see useChargeStatus.STALE_AFTER_MS). After our own 15-minute deadline it says
// "อาจหมดอายุ" — อาจ, because that is the honest strength of the claim — and hands the user two ways forward
// instead of a verdict.
import Image from 'next/image'
import { useEffect } from 'react'
import { useChargeStatus } from '../useChargeStatus'

/** Every user-visible string on this screen, in one place, for the DoD's per-line audit. */
export const QR_COPY = {
  title: 'สแกนเพื่อชำระเงิน',
  howto: 'เปิดแอปธนาคารของคุณ แล้วสแกน QR นี้',
  waiting: 'กำลังรอการชำระเงิน…',
  // ❌ never "ล้มเหลว": a network hiccup on our side is not the user's payment failing.
  offline: 'ตอนนี้เช็คสถานะไม่ได้ กำลังลองใหม่ให้อัตโนมัติ',
  // อาจ — we do not know. See the header.
  maybeExpired: 'QR นี้อาจหมดอายุแล้ว ถ้าคุณจ่ายไปแล้วให้กดตรวจสอบอีกครั้ง',
  checkAgain: 'ตรวจสอบอีกครั้ง',
  newQr: 'ขอ QR ใหม่',
  amountLabel: 'ยอดชำระ',
} as const

export type QrScreenProps = {
  chargeId: string
  qrUrl: string
  amountText: string
  onApproved: () => void
  onNewQr: () => void
  /** Back. It navigates and NOTHING else — see the ticket criteria: a charge the user may still pay must
   *  not be cancelled on their way out, and the code's quota hold releases itself within the quote TTL. */
  onBack: () => void
}

export function QrScreen({ chargeId, qrUrl, amountText, onApproved, onNewQr, onBack }: QrScreenProps) {
  const { status, error, stale, check } = useChargeStatus(chargeId)
  // 🔴 In an effect, not in the render body. Calling onApproved() while rendering fires it again on every
  // subsequent render and pushes a parent state update into React's render phase — the settle would be
  // announced repeatedly, and on a payment screen "repeatedly" can mean a second navigation or a second
  // charge. The dependency list makes it exactly once per settle.
  useEffect(() => {
    if (status === 'APPROVED') onApproved()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status])

  return (
    <div data-testid="qr-screen" className="flex w-full flex-col items-center gap-4 font-ibm">
      <h1 className="text-2xl font-bold leading-8 text-v3-navy">{QR_COPY.title}</h1>
      <p className="text-sm leading-[22px] text-v3-text-body">{QR_COPY.howto}</p>

      {/* testid on the WRAPPER: next/image does not forward arbitrary props to the rendered <img>, so a
          testid placed on it is a selector that would quietly never match. */}
      <div data-testid="qr-image" className="relative size-[240px] overflow-hidden rounded-2xl border border-v3-border-card bg-white p-3">
        {/* unoptimized: the QR is a signed one-shot URL on Omise's CDN, not an asset we own or can re-host. */}
        <Image src={qrUrl} alt={QR_COPY.title} fill unoptimized className="object-contain p-3" />
      </div>

      <p className="text-base font-bold leading-6 text-v3-navy">
        {QR_COPY.amountLabel} <span data-testid="qr-amount">{amountText}</span>
      </p>

      {!stale && (
        <p data-testid="qr-waiting" role="status" aria-live="polite" className="text-sm leading-[22px] text-v3-text-muted">
          {error ? QR_COPY.offline : QR_COPY.waiting}
        </p>
      )}

      {stale && (
        <div data-testid="qr-stale" className="flex w-full flex-col items-center gap-3">
          <p role="status" className="text-center text-sm leading-[22px] text-v3-text-body">{QR_COPY.maybeExpired}</p>
          <div className="flex w-full gap-2">
            <button type="button" data-testid="qr-check-again" onClick={check} className="flex-1 rounded-pill border-[1.5px] border-v3-sapphire px-5 py-2.5 text-sm font-medium text-v3-sapphire">
              {QR_COPY.checkAgain}
            </button>
            <button type="button" data-testid="qr-new" onClick={onNewQr} className="flex-1 rounded-pill bg-v3-sapphire px-5 py-2.5 text-sm font-medium text-white">
              {QR_COPY.newQr}
            </button>
          </div>
        </div>
      )}

      <button type="button" data-testid="qr-back" onClick={onBack} className="text-sm text-v3-text-muted underline">
        ย้อนกลับ
      </button>
    </div>
  )
}

export default QrScreen
