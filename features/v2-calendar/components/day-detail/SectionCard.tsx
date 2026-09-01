// Collapsible section card (DESIGN.md "Result section card 636-19595": white r20 pad16H/24V + shadow,
// collapsible header + hairline + content). Every day-detail section (§6-§13) is one of these: a title,
// an optional cyan ⓘ info glyph, and a chevron that collapses the body. Toggle is INSTANT (no transition)
// → nothing animates off-screen (the long-frame battery rule is satisfied by construction, not by pausing).
import { useId, useState, type ReactNode } from 'react'

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
  /**
   * The ⓘ explanation. `true` keeps the OLD behaviour — glyph only, nothing behind it — because two
   * callers still pass a bare `info` and ฟีม has only supplied copy for two of the three (#565).
   * Pass a node and the glyph becomes a real control that opens the text inside the card.
   */
  info?: ReactNode
  defaultOpen?: boolean
  /** stable handle for the tier-gate anchor — a paid-only section has to be provably ABSENT for a free
   *  member, and "absent" needs something to look for that is not the Thai heading text. */
  testId?: string
  children: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  const [infoOpen, setInfoOpen] = useState(false)
  const infoId = useId()
  // `info` doubles as "draw the glyph" and "here is the text". Only a NODE is a real explanation;
  // a bare `info` (=== true) is the old glyph-with-nothing-behind-it and stays inert.
  const hasInfoText = info !== true && info != null && info !== false

  return (
    <section data-testid={testId} className="rounded-[20px] bg-white px-4 py-5 shadow-[0_4px_14px_rgba(26,38,77,0.06)]">
      {/* The header used to be ONE button with the ⓘ inside it. A button inside a button is invalid HTML
          and the inner one never receives the click, so the ⓘ could not become a control without this
          split. Title and chevron are one control; the ⓘ is its own. */}
      <div className="flex w-full items-center gap-2">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex min-w-0 items-center gap-2 text-left"
        >
          <h2 className="text-base font-bold text-v3-navy">{title}</h2>
        </button>
        {info ? (
          hasInfoText ? (
            <button
              type="button"
              data-testid="section-info-toggle"
              onClick={() => setInfoOpen((v) => !v)}
              aria-expanded={infoOpen}
              aria-controls={infoId}
              aria-label={`${infoOpen ? 'ปิด' : 'เปิด'}คำอธิบาย ${title}`}
              className="-m-1 flex size-7 items-center justify-center rounded-full p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-v3-sapphire"
            >
              <InfoDot />
            </button>
          ) : (
            <InfoDot />
          )
        ) : null}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-hidden
          tabIndex={-1}
          className="ml-auto text-v3-navy/70"
        >
          {/* chevron: ^ when open, v when collapsed (instant, no motion) */}
          <svg viewBox="0 0 20 20" aria-hidden className={`size-5 transition-none ${open ? '' : 'rotate-180'}`} fill="none">
            <path d="M5 12.5 10 7.5l5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
      {/* hairline under the header (Figma: faint dashed rule) */}
      <div className="mt-2.5 border-b border-dashed border-[#EBD9C8]" />
      {/* The explanation is an INLINE panel, not a floating popover. components/calculator/BadgeMarker.tsx
          is the floating one and #416 recorded what it costs: it positions with window.innerWidth and was
          tuned at 390 only, so it has to be re-checked at every width forever. A panel in normal flow
          cannot overflow the card, so the whole 320/360/393 question is answered by construction rather
          than by a measurement that has to be repeated. */}
      {hasInfoText && infoOpen && (
        <div
          id={infoId}
          data-testid="section-info-panel"
          className="mt-3 rounded-2xl bg-v3-ghost-white px-3.5 py-3 text-[13px] leading-[22px] text-v3-text-body"
        >
          {info}
        </div>
      )}
      {open && <div className="mt-3.5">{children}</div>}
    </section>
  )
}
