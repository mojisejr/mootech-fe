// features/v2-shell/components/LoadingScreen.tsx — reusable full-viewport "please wait" surface.
// Slice 2 · ก้อน 2D · LOOK from Figma 375:20499 (a payment-processing screen): the cloud-sky bg
// (BG01 — byte-identical to that node's fill, md5 fc9a47ba…, already shipped + used by home/service/
// compat, so this loader is visually continuous with the screen it covers) + the leaf mascot
// (zone4/mascot-leaf.png — the exact "โปเตโต้" from the node) + a centred stack.
//
// D16: the node's PAYMENT COPY ("กำลังดำเนินการชำระเงิน" / "Omise …") is NOT baked in. `title` and
//      `subtitle` are props so this ONE shell serves any wait — compat calc, payment, save, …. No
//      "ชำระเงิน"/"Omise" string lives in this component.
// D18: role="status" + aria-live="polite" → a screen-reader user hears the wait announced on mount.
// Motion is behind `motion-safe:` — prefers-reduced-motion falls back to the static resting pose
// (mascot translateY(0), sparkle full-opacity), which is also what the @393 screenshot captures.
import type { ReactNode } from 'react'
import { FullBleedScreen } from './FullBleedScreen'

function LoadingSparkle({ className }: { className?: string }) {
  // single 4-point sparkle above the mascot (Figma ✨, white). Inline SVG — project convention (icons local).
  return (
    <svg viewBox="0 0 24 24" width={24} height={24} fill="none" aria-hidden className={className}>
      <path
        d="M12 1c.7 5.2 2.6 7.1 7.8 7.8C14.6 9.5 12.7 11.4 12 16.6 11.3 11.4 9.4 9.5 4.2 8.8 9.4 8.1 11.3 6.2 12 1Z"
        fill="#FFFFFF"
      />
    </svg>
  )
}

export function LoadingScreen({
  title,
  subtitle,
  className,
}: {
  /** the primary line (e.g. "กำลังคำนวณดวงสมพงศ์"). NEVER hard-coded payment copy — always a prop (D16). */
  title: string
  /** optional supporting line(s). ReactNode so a caller can pass 2-line / coloured copy if needed. */
  subtitle?: ReactNode
  className?: string
}) {
  return (
    <FullBleedScreen
      bgSrc="/images/v2/bg/BG01.png"
      // gradient placeholder shown until the photo paints (sky-blue → lavender → pink, the BG01 palette)
      bgFallback="linear-gradient(180deg,#CBE4FB 0%,#E7E4FA 46%,#F8DCEC 100%)"
      bgPosition="center"
      contentClassName="items-center justify-center px-8 text-center"
      className={className}
    >
      {/* the announced region — mount = a polite "loading" announcement for AT/screen readers (D18) */}
      <div role="status" aria-live="polite" className="flex flex-col items-center gap-4">
        <div className="relative flex flex-col items-center">
          <LoadingSparkle className="absolute -top-6 motion-safe:animate-sparkle-twinkle" />
          <img
            src="/images/v2/zone4/mascot-leaf.png"
            alt=""
            aria-hidden
            width={72}
            height={90}
            className="h-[90px] w-[72px] select-none motion-safe:animate-mascot-float"
          />
        </div>
        <div className="flex flex-col items-center gap-1">
          <h1 className="font-ibm text-[22px] font-bold leading-8 text-v3-navy">{title}</h1>
          {subtitle ? (
            <div className="font-ibm text-[15px] font-normal leading-[22px] text-v3-navy/70">{subtitle}</div>
          ) : null}
        </div>
        {/* generic fallback for AT even if `title` is terse; visually hidden */}
        <span className="sr-only">กำลังโหลด กรุณารอสักครู่</span>
      </div>
    </FullBleedScreen>
  )
}

export default LoadingScreen
