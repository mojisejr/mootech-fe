import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { PolicyText } from '@/features/v2-privacy/PolicyText'
import { FirstRunScreen } from './FirstRunScreen'

// PdpaConsentScreen — the privacy policy step, used by sign-up (/v2/first-run) and by the updated-policy screen
// (/v2/policy-update). CIEL mumate-pdpa-reconsent-001 plan 0.3 (owner 2026-10-23, the business team's ask):
//   • the FULL policy as plain text (constants/privacy-policy.ts via PolicyText) — no cards, no summary, no link;
//   • ONE tick, in a bar fixed to the bottom with a read-progress line (sample A). The tick unlocks only once the end
//     of the policy has been reached; tapping it earlier keeps it empty and shows READ_TO_END_MESSAGE;
//   • no AI box: accepting turns the AI item on (opt-out) — the caller does that; no notice follows (team, 2026-10-24).
// The button still needs the tick (issue #215's gate): strip `disabled={!consent ...}` and
// scripts/first-run-screens.test.tsx must go red.
//
// "Reached the end" = a sentinel after the policy text is visible above the fixed bar (IntersectionObserver).
// The observer reports at once, so a policy that already fits on the screen unlocks without scrolling. A browser
// without IntersectionObserver unlocks at once too: the rule must never lock a member out of the app.

export const READ_TO_END_MESSAGE = 'กรุณาเลื่อนอ่านนโยบายให้จบก่อน จึงจะติ๊กยอมรับได้'
export const CONSENT_LABEL = 'ฉันอ่านและยอมรับนโยบายความเป็นส่วนตัว'

const COPY = {
  'first-run': {
    title: 'ความเป็นส่วนตัวของคุณ',
    lead: 'กรุณาอ่านนโยบายความเป็นส่วนตัวให้จบ แล้วติ๊กยอมรับเพื่อดำเนินการต่อ',
    button: 'ยอมรับและดำเนินการต่อ',
  },
  // Neutral on purpose (owner 2026-10-22): the heading and lead say only that the policy was updated.
  update: {
    title: 'นโยบายความเป็นส่วนตัวฉบับปรับปรุง',
    lead: 'เราปรับปรุงรายละเอียดบางส่วนเพื่อให้ดูแลข้อมูลของคุณได้ดียิ่งขึ้น กรุณาอ่านให้จบ แล้วติ๊กยอมรับเพื่อใช้งานต่อ',
    button: 'ยอมรับและใช้งานต่อ',
  },
} as const

function useReadToEnd() {
  const sentinel = useRef<HTMLDivElement>(null)
  const bar = useRef<HTMLDivElement>(null)
  const [reached, setReached] = useState(false)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const el = sentinel.current
    if (!el || typeof IntersectionObserver === 'undefined') {
      setReached(true)
      return
    }
    const barHeight = bar.current?.offsetHeight ?? 0
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setReached(true)
          io.disconnect()
        }
      },
      { rootMargin: `0px 0px -${barHeight}px 0px` },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  useEffect(() => {
    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight
      setProgress(max <= 0 ? 100 : Math.min(100, Math.round((window.scrollY / max) * 100)))
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return { sentinel, bar, reached, progress: reached ? 100 : progress }
}

export function PdpaConsentScreen({
  variant = 'first-run',
  consent,
  onConsentChange,
  onBack,
  onAccept,
  saving = false,
  error = false,
}: {
  /** 'update' = an onboarded member accepting an updated policy (/v2/policy-update): no pager, neutral heading. */
  variant?: 'first-run' | 'update'
  consent: boolean
  onConsentChange: (next: boolean) => void
  onBack?: () => void
  onAccept?: () => void
  /** the caller is saving consent — button shows progress + locks to stop a double-submit (#233). */
  saving?: boolean
  /** the save failed — show a retriable message; the button stays usable (do NOT disable on error). */
  error?: boolean
}) {
  const copy = COPY[variant]
  const { sentinel, bar, reached, progress } = useReadToEnd()
  const [warned, setWarned] = useState(0)

  useEffect(() => {
    if (!warned) return
    if (reached) {
      setWarned(0) // the warning is about the end not reached yet — gone the moment it is
      return
    }
    const t = setTimeout(() => setWarned(0), 3000)
    return () => clearTimeout(t)
  }, [warned, reached])

  const tryTick = (next: boolean) => {
    if (!reached) {
      setWarned((n) => n + 1)
      return
    }
    onConsentChange(next)
  }

  return (
    <FirstRunScreen
      step={variant === 'update' ? null : 1}
      onBack={onBack}
      // room under the text so its last lines can scroll clear of the fixed bar
      footer={<div aria-hidden className="h-48" />}
      contentClassName="gap-6 px-6 pt-8"
    >
      <div className="flex flex-col gap-3 text-center">
        <h1 className="font-ibm text-2xl font-bold leading-8 text-v3-text-title">{copy.title}</h1>
        <p className="font-ibm text-base leading-6 text-v3-text-body">{copy.lead}</p>
      </div>

      <PolicyText />
      <div ref={sentinel} aria-hidden className="h-px" data-testid="policy-end" />

      <div className="fixed inset-x-0 bottom-0 z-40">
        <div ref={bar} className="relative mx-auto w-full max-w-md border-t border-v3-border-card bg-white px-6" style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}>
          {warned ? (
            <p
              role="status"
              className="absolute inset-x-4 bottom-full mb-3 rounded-2xl bg-v3-text-price px-4 py-3 text-center font-ibm text-sm leading-5 text-white shadow-lg"
              data-testid="read-to-end-warning"
            >
              {READ_TO_END_MESSAGE}
            </p>
          ) : null}
          <div className="-mx-6 h-[3px] bg-v3-ghost-white" aria-hidden>
            <div className="h-full bg-v3-sapphire transition-[width] duration-150" style={{ width: `${progress}%` }} />
          </div>
          <p className={reached ? 'mt-2 text-center font-ibm text-xs font-semibold leading-[18px] text-v3-text-title' : 'mt-2 text-center font-ibm text-xs leading-[18px] text-v3-text-muted'}>
            {reached ? 'อ่านครบแล้ว ติ๊กยอมรับได้เลย' : `เลื่อนอ่านให้จบเพื่อติ๊กยอมรับ · อ่านแล้ว ${progress}%`}
          </p>
          <div className="mt-2 flex items-center gap-3">
            <Checkbox checked={consent} onChange={tryTick} ariaLabel={CONSENT_LABEL} />
            <span
              onClick={() => tryTick(!consent)}
              className={reached ? 'cursor-pointer font-ibm text-base leading-6 text-v3-text-title' : 'cursor-pointer font-ibm text-base leading-6 text-v3-text-muted'}
            >
              {CONSENT_LABEL}
            </span>
          </div>
          <div className="mt-3 flex flex-col gap-2">
            {/* THE gate. `disabled={!consent}` is the whole point of this screen (issue #215). `|| saving` only ADDS a
                lock while the save is in flight. */}
            <Button onClick={onAccept} disabled={!consent || saving}>
              {saving ? 'กำลังบันทึก…' : copy.button}
            </Button>
            {error ? (
              <p className="text-center font-ibm text-sm leading-5 text-v3-error" role="alert">
                บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </FirstRunScreen>
  )
}

export default PdpaConsentScreen
