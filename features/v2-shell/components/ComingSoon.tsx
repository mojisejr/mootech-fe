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
//
// ONE TOAST PER DOCUMENT, not one per action (ตู๋ 2026-08-06). The month screen has two actions — the
// อัพเกรด pill and the avatar — so every action rendering its own notice meant a single tap produced TWO,
// stacked at identical fixed coordinates. Sighted users see one and notice nothing; a screen reader reads
// the sentence twice. That directly contradicts the reason this component exists, written six lines above:
// a response only sighted users receive would be half the fix. So the first mounted toast CLAIMS the slot
// and the rest render nothing; when it unmounts the claim is released and the next mount takes it.
import { useEffect, useState, type ReactNode } from 'react'

type Listener = (msg: string | null) => void
const listeners = new Set<Listener>()
let current: string | null = null
let seq = 0
// #323 — THE EXPIRY LIVES WHERE THE STATE LIVES. It used to be a useRef inside each <ComingSoonAction/>,
// and that control's unmount cleanup ran `clearTimeout` — so tapping a control and leaving the page inside
// VISIBLE_MS cancelled the only thing that would ever reset `current`. `current` then survived for the life
// of the tab, and the next ComingSoonToast to mount read it in `useState(current)` and showed a toast the
// user never asked for, on a different screen. The state is module-scoped; an expiry owned by a component
// is an expiry that dies whenever that component does. Clearing `current` on unmount instead would have
// been the fast fix and the wrong one — it breaks the hand-over that `elect()` exists for (see below).
let expiry: ReturnType<typeof setTimeout> | null = null

/** show the notice. A later call replaces an earlier one rather than queueing behind it. */
function announce(msg: string) {
  current = msg
  seq += 1
  listeners.forEach((l) => l(current))
  const token = seq
  if (expiry) clearTimeout(expiry)
  expiry = setTimeout(() => clear(token), VISIBLE_MS)
}
function clear(token: number) {
  if (token !== seq) return // a newer message arrived; this timeout is stale
  current = null
  if (expiry) {
    clearTimeout(expiry)
    expiry = null
  }
  listeners.forEach((l) => l(null))
}

/**
 * #326 — announce the same notice from a control this component does NOT wrap. The day-detail bottom-bar
 * CTA is drawn by <Menubar/>, so it cannot be wrapped in <ComingSoonAction/>; it calls this instead and
 * renders <ComingSoonNotice/> itself. Exported so that "a locked control says something" has ONE
 * implementation, not a second copy that drifts.
 */
export function announceComingSoon(message: string) {
  announce(message)
}

const DEFAULT_MESSAGE = 'ฟีเจอร์นี้กำลังจะมา เร็วๆ นี้'
const VISIBLE_MS = 2200
// (announce/clear above reference VISIBLE_MS from inside their bodies, which run after module init.)

/**
 * The notice itself. Fixed above the bottom menu, out of flow, so it cannot shift anything on the page —
 * the same reasoning as the tier spinner on the calendar screens.
 */
// The claim is an ordered list rather than a boolean, so it can be HANDED OVER. ตู๋ 2026-08-06: with a
// boolean, the owner unmounting released the flag but every survivor kept `owns === false` forever (deps
// are []), leaving no toast at all. It was safe only because of the order things happen to mount in — safe
// by accident is the shape we spent the day removing.
const mounted: Array<(owns: boolean) => void> = []
const elect = () => mounted.forEach((set, i) => set(i === 0))

export function ComingSoonNotice() {
  return <ComingSoonToast />
}

function ComingSoonToast() {
  const [msg, setMsg] = useState<string | null>(current)
  const [owns, setOwns] = useState(false)
  useEffect(() => {
    listeners.add(setMsg) // every instance listens; non-owners simply render nothing
    mounted.push(setOwns)
    elect()
    return () => {
      listeners.delete(setMsg)
      mounted.splice(mounted.indexOf(setOwns), 1)
      elect() // the next one in line takes over instead of the notice disappearing for good
    }
  }, [])
  if (!owns || !msg) return null
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
  // #323 — no timer here on purpose. The notice's lifetime belongs to the module store, not to this
  // button; a button that unmounts must not take the countdown with it.
  return (
    <>
      <button
        type="button"
        data-testid={testId}
        data-coming-soon="true"
        aria-label={label}
        onClick={() => announce(message)}
        className={className}
      >
        {children}
      </button>
      <ComingSoonToast />
    </>
  )
}

export { DEFAULT_MESSAGE as COMING_SOON_MESSAGE }
