// features/v2-shell/components/TopBarBell.tsx — the notification bell shared by every v2 top-bar
// (home, calendar day-header, service hub). ฟีม: "the bell on every page is the same thing — make it one
// shared component, reused." Extracted from home's local BellButton (V2HomeScreen) + calendar's inline bell.
//
// TWO axes are props so the behaviour and look each change in ONE place:
//   • BEHAVIOUR — pass `href` → renders a <Link> (nav, e.g. → /v2/calendar/notifications); pass `onClick`
//     → renders a <button> (in-page action, e.g. open a panel). Exactly one. This is the "single point of
//     change" ฟีม asked for: to make the bell go to the notifications page everywhere, give every call an
//     href — no page is rewritten.
//   • SKIN — `variant`: 'solid' (home/service: cyan ground, white glyph, unread-dot slot) · 'mate'
//     (calendar: mate-gradient ground, lime glyph). The skins are DIFFERENT today (that's the reality บอง
//     found — 3 pages, not 1 look); each variant reproduces its page's CURRENT pixels EXACTLY so nothing
//     shifts. When ฟีม picks ONE unified look, delete the other variant (or flip the default) — one edit.
import Link from 'next/link'
import type { ReactNode } from 'react'

type Variant = 'solid' | 'mate'
type TopBarBellProps = {
  variant?: Variant
  /** nav target — renders a <Link>. Mutually exclusive with onClick. */
  href?: string
  /** in-page action — renders a <button>. Mutually exclusive with href. */
  onClick?: () => void
  /** unread indicator (solid skin only — the dot the home bell already reserves). */
  hasUnread?: boolean
  /** accessible label (default "การแจ้งเตือน"). */
  label?: string
  /** test hook (e.g. the calendar bell's existing "header-notif-bell"). */
  testId?: string
}

// Each variant reproduces its source page's exact bell markup — same wrapper classes, same glyph, same
// stroke — so swapping a page onto this component moves ZERO pixels.
const SKIN: Record<Variant, { wrap: string; glyph: ReactNode }> = {
  solid: {
    wrap: 'relative grid size-10 shrink-0 place-items-center rounded-full bg-v3-cyan text-white',
    glyph: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8A6 6 0 1 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.7 21a2 2 0 0 1-3.4 0" />
      </svg>
    ),
  },
  mate: {
    wrap: 'grid size-10 place-items-center rounded-full bg-gradient-to-br from-v3-mate-teal to-v3-mate-purple',
    glyph: (
      <svg viewBox="0 0 24 24" className="size-6 text-v3-lime" fill="none" aria-hidden>
        <path d="M12 3.5a5 5 0 0 1 5 5v3l1.4 2.4a1 1 0 0 1-.86 1.5H6.46a1 1 0 0 1-.86-1.5L7 11.5v-3a5 5 0 0 1 5-5Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
        <path d="M10 18a2 2 0 0 0 4 0" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    ),
  },
}

export function TopBarBell({ variant = 'solid', href, onClick, hasUnread = false, label = 'การแจ้งเตือน', testId }: TopBarBellProps) {
  const skin = SKIN[variant]
  const dot = variant === 'solid' && hasUnread
    ? <span aria-hidden data-testid="unread-dot" className="absolute right-1.5 top-1.5 size-2.5 rounded-full bg-v3-pumpkin ring-2 ring-white" />
    : null

  if (href) {
    return (
      <Link href={href} aria-label={label} data-testid={testId} className={skin.wrap}>
        {skin.glyph}
        {dot}
      </Link>
    )
  }
  return (
    <button type="button" aria-label={label} data-testid={testId} onClick={onClick} className={skin.wrap}>
      {skin.glyph}
      {dot}
    </button>
  )
}
