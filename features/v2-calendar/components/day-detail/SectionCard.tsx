// Collapsible section card (DESIGN.md "Result section card 636-19595": white r20 pad16H/24V + shadow,
// collapsible header + hairline + content). Every day-detail section (§6-§13) is one of these: a title,
// an optional cyan ⓘ info glyph, and a chevron that collapses the body. Toggle is INSTANT (no transition)
// → nothing animates off-screen (the long-frame battery rule is satisfied by construction, not by pausing).
import { useState, type ReactNode } from 'react'

function InfoDot() {
  // ⓘ — cyan action glyph (DESIGN.md: info icon = cyan #1B9AAF).
  return (
    <svg viewBox="0 0 20 20" aria-hidden className="size-[18px]" fill="none">
      <circle cx="10" cy="10" r="8.25" stroke="#1B9AAF" strokeWidth="1.5" />
      <circle cx="10" cy="6.4" r="1" fill="#1B9AAF" />
      <rect x="9.1" y="8.8" width="1.8" height="5.2" rx="0.9" fill="#1B9AAF" />
    </svg>
  )
}

export function SectionCard({
  title,
  info = false,
  defaultOpen = true,
  testId,
  children,
}: {
  title: string
  info?: boolean
  defaultOpen?: boolean
  /** stable handle for the tier-gate anchor — a paid-only section has to be provably ABSENT for a free
   *  member, and "absent" needs something to look for that is not the Thai heading text. */
  testId?: string
  children: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <section data-testid={testId} className="rounded-[20px] bg-white px-4 py-5 shadow-[0_4px_14px_rgba(26,38,77,0.06)]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-2"
      >
        <h2 className="text-base font-bold text-v3-navy">{title}</h2>
        {info && <InfoDot />}
        <span className="ml-auto text-v3-navy/70">
          {/* chevron: ^ when open, v when collapsed (instant, no motion) */}
          <svg viewBox="0 0 20 20" aria-hidden className={`size-5 transition-none ${open ? '' : 'rotate-180'}`} fill="none">
            <path d="M5 12.5 10 7.5l5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </button>
      {/* hairline under the header (Figma: faint dashed rule) */}
      <div className="mt-2.5 border-b border-dashed border-[#EBD9C8]" />
      {open && <div className="mt-3.5">{children}</div>}
    </section>
  )
}
