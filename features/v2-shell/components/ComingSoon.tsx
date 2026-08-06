// features/v2-shell/components/ComingSoon.tsx — "this looks like a control, and it is one; it just has
// nowhere to go yet."
//
// ฟีม 2026-08-06 ruled แบบ ก for the five controls that are drawn as buttons and do nothing: tapping them
// must SAY something. Until now the codebase handled the same problem the honest-but-silent way — render a
// <span> so no dead <button> swallows the tap (TopBarAvatar's header note records that ruling). Silence is
// truthful to a screen reader and to the markup, but on a phone it is indistinguishable from a broken app:
// the user taps the lime pill, nothing moves, and they conclude the button is broken rather than unbuilt.
//
// So the control becomes real and answers. It does not pretend to succeed — the answer is "เร็วๆ นี้".
//
// NO PROVIDER, ON PURPOSE. These controls live in three different shells (calendar month, day detail, the
// shared header) and one of them is rendered by pages outside this feature. A context would force a layout
// change in every one of them, which is a lot of blast radius for a toast. Instead the toast subscribes to a
// module-level store, and each <ComingSoonAction/> renders it, so mounting is automatic wherever an action
// exists. The store keeps only the LATEST message so two quick taps cannot stack two toasts.
import { useEffect, useRef, useState, type ReactNode } from 'react'

type Listener = (msg: string | null) => void
const listeners = new Set<Listener>()
let current: string | null = null
let seq = 0

/** show the notice. A later call replaces an earlier one rather than queueing behind it. */
function announce(msg: string) {
  current = msg
  seq += 1
  listeners.forEach((l) => l(current))
}
function clear(token: number) {
  if (token !== seq) return // a newer message arrived; this timeout is stale
  current = null
  listeners.forEach((l) => l(null))
}

const DEFAULT_MESSAGE = 'ฟีเจอร์นี้กำลังจะมา เร็วๆ นี้'
const VISIBLE_MS = 2200

/**
 * The notice itself. Fixed above the bottom menu, out of flow, so it cannot shift anything on the page —
 * the same reasoning as the tier spinner on the calendar screens.
 */
function ComingSoonToast() {
  const [msg, setMsg] = useState<string | null>(current)
  useEffect(() => {
    listeners.add(setMsg)
    return () => {
      listeners.delete(setMsg)
    }
  }, [])
  if (!msg) return null
  return (
    <div
      data-testid="coming-soon-toast"
      // role=status + aria-live means a screen reader hears the answer too. The whole point of this change
      // is that a tap gets a response; a response only sighted users receive would be half the fix.
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-[104px] z-[60] flex justify-center px-6"
    >
      <span className="rounded-full bg-v3-navy/90 px-4 py-2 text-center text-[13px] font-medium leading-5 text-white shadow-[0_6px_18px_rgba(11,48,91,0.28)]">
        {msg}
      </span>
    </div>
  )
}

/**
 * Wraps whatever the control already looked like in a real <button> that answers when tapped.
 *
 * `className` is the caller's existing pill/tile classes verbatim — the pixels do not change, which matters:
 * this PR is about behaviour, and a visual diff here would make it impossible to review as such.
 */
export function ComingSoonAction({
  children,
  className,
  label,
  message = DEFAULT_MESSAGE,
  testId,
}: {
  children: ReactNode
  className: string
  /** what the control is, for a screen reader — the visible text is often an image or a single letter */
  label: string
  message?: string
  testId?: string
}) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])
  return (
    <>
      <button
        type="button"
        data-testid={testId}
        data-coming-soon="true"
        aria-label={label}
        onClick={() => {
          announce(message)
          const token = seq
          if (timer.current) clearTimeout(timer.current)
          timer.current = setTimeout(() => clear(token), VISIBLE_MS)
        }}
        className={className}
      >
        {children}
      </button>
      <ComingSoonToast />
    </>
  )
}

export { DEFAULT_MESSAGE as COMING_SOON_MESSAGE }
