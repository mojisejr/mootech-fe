import { useRef, type KeyboardEvent } from 'react'
import { cn } from '@/lib/utils/cn'

export type PillTabItem = { label: string; value: string }

// PillTabs — V3 segmented tab control (DESIGN.md §6 "Tab / Pill Tabs", node 375-10888).
// Track: bg #EBEBEB (v3-tab-track) · pad 4px · radius 50px.
// Segment: pad 12H/8V · pill radius · label Poppins SemiBold 14 #222 (v3-shade-02).
// Selected: bg white + drop-shadow 0px 6px 8.5px rgba(0,0,0,.08) (§4 exception — the one
//   place a V3 surface carries a shadow). Focus (unselected): bg #F7F7F7 (v3-tab-focus)
//   + 2px #222 (v3-shade-02) border, applied TOGETHER.
// A11y: segmented control = radiogroup + radio (roving tabindex + arrow-key navigation),
//   not tablist/tab — a tab list controls panels, this picks one value from a set.
export function PillTabs({
  items,
  value,
  onChange,
  className,
  ariaLabel,
}: {
  items: PillTabItem[]
  value: string
  onChange: (value: string) => void
  className?: string
  /** Accessible name for the group — applied as aria-label on the radiogroup. */
  ariaLabel?: string
}) {
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([])

  // Roving tabindex: the checked radio is the single tab stop (tabindex 0); if the
  // current value matches nothing, the first segment becomes the tab stop instead.
  const checkedIndex = items.findIndex((item) => item.value === value)
  const tabStopIndex = checkedIndex === -1 ? 0 : checkedIndex

  function moveTo(index: number) {
    const count = items.length
    if (count === 0) return
    const next = ((index % count) + count) % count
    onChange(items[next].value)
    buttonRefs.current[next]?.focus()
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        event.preventDefault()
        moveTo(index + 1)
        break
      case 'ArrowLeft':
      case 'ArrowUp':
        event.preventDefault()
        moveTo(index - 1)
        break
      default:
        break
    }
  }

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn(
        'inline-flex items-center gap-1 rounded-[50px] bg-v3-tab-track p-1',
        className,
      )}
    >
      {items.map((item, index) => {
        const selected = item.value === value
        return (
          <button
            key={item.value}
            ref={(node) => {
              buttonRefs.current[index] = node
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={index === tabStopIndex ? 0 : -1}
            onClick={() => onChange(item.value)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            className={cn(
              // base segment — transparent border reserves the 2px so focus recolors,
              // never resizes (no layout shift)
              'flex-1 rounded-full border-2 border-transparent px-3 py-2 text-center font-poppins-v3 text-sm font-semibold text-v3-shade-02 transition-colors',
              // focus-visible = §6 focus border (2px #222 / v3-shade-02) on the focused segment
              'outline-none focus-visible:border-v3-shade-02',
              selected
                ? // selected — white fill + the §4 shadow exception
                  'bg-white shadow-[0px_6px_8.5px_rgba(0,0,0,0.08)]'
                : // unselected — transparent on the track; hover + focus lift to tab-focus
                  // (§6 "Focus (unselected)" = bg #F7F7F7 AND the 2px border together)
                  'bg-transparent hover:bg-v3-tab-focus focus-visible:bg-v3-tab-focus',
            )}
          >
            {item.label}
          </button>
        )
      })}
    </div>
  )
}
