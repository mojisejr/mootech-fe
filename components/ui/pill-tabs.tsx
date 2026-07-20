import { useRef, type KeyboardEvent } from 'react'
import { cn } from '@/lib/utils/cn'

export type PillTabItem = { label: string; value: string }
export type PillTabsVariant = 'neutral' | 'calendar'

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
  variant = 'neutral',
}: {
  items: PillTabItem[]
  value: string
  onChange: (value: string) => void
  className?: string
  /** Accessible name for the group — applied as aria-label on the radiogroup. */
  ariaLabel?: string
  /** `neutral` (default, #EBEBEB track + white-thumb, §6) · `calendar` (white track,
   *  sapphire-fill + lime-label selected, node 375-17085). */
  variant?: PillTabsVariant
}) {
  const isCalendar = variant === 'calendar'
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
        'inline-flex items-center gap-1 rounded-[50px] p-1',
        // track: neutral = #EBEBEB · calendar = white
        isCalendar ? 'bg-white' : 'bg-v3-tab-track',
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
              // never resizes (no layout shift). NO text color here — set exactly once
              // per state branch below so two text-* utilities never collide (cn no-dedupe).
              'flex-1 rounded-full border-2 border-transparent px-3 py-2 text-center font-poppins-v3 text-sm font-semibold transition-colors outline-none',
              // focus border: neutral = #222 · calendar = sapphire
              isCalendar
                ? 'focus-visible:border-v3-sapphire'
                : 'focus-visible:border-v3-shade-02',
              selected
                ? isCalendar
                  ? // calendar selected — sapphire fill + lime label, NO shadow
                    'bg-v3-sapphire text-v3-lime'
                  : // neutral selected — white fill + #222 label + §4 shadow exception
                    'bg-white text-v3-shade-02 shadow-[0px_6px_8.5px_rgba(0,0,0,0.08)]'
                : isCalendar
                  ? // calendar unselected — lemon-chiffon fill + sapphire label
                    'bg-v3-lemon-chiffon text-v3-sapphire hover:brightness-95 focus-visible:brightness-95'
                  : // neutral unselected — transparent + #222 label; hover/focus lift to tab-focus
                    'bg-transparent text-v3-shade-02 hover:bg-v3-tab-focus focus-visible:bg-v3-tab-focus',
            )}
          >
            {item.label}
          </button>
        )
      })}
    </div>
  )
}
