// features/v2-calendar/components/DateSelector.tsx — the month/year picker row on ปฏิทินดวง.
//
// ฟีม handed the design as an SVG export straight from the file. I rendered it and read the values off the
// render rather than eyeballing the markup:
//
//   [ วันนี้ 84×62 ]  [ เดือน ▾  150×62 ]  [ ปี (พ.ศ.) ▾  110×62 ]     gap 8.5 · total 361
//   card  : white · r14–16 · border #E0DEDB (= v3-border-warm) · drop-shadow 0 3 10 rgba(26,38,77,.06)
//   label : 14 #464646        value : 20 bold #0B305B        chevron : #4B5563
//
// It replaces `วันนี้ + ‹ › + "กรกฎาคม · 2569"`, which could only step ONE month at a time — reaching a date
// six months out took six taps and there was no way to change the year at all.
//
// WHY A SHEET AND NOT A <select>: on iOS a native select opens the system picker, which renders the month
// list in the OS language and — for the year — Gregorian digits. This screen is Buddhist-era; a picker that
// silently shows 2026 next to a page that says 2569 is worse than no picker. The sheet is 12 plain buttons.
//
// The cursor still belongs to goo's `useCalendarMonth` (goPrev/goNext/goToday). This component does not own
// state; `onPick(year, month)` is applied by stepping that cursor, so the hook's signature is untouched.
//
// ── selector-always (2026-08-07) ────────────────────────────────────────────────────────────────────────
// This row used to render only inside the page's `viewState === 'ready'` branch, so the moment a month was
// in flight or failed to arrive it vanished — WITH the only controls that could get the user out. Measured
// on main a4560da before touching anything: present in 1 of 6 states, and gone for 53 consecutive frames
// (~865ms, i.e. as long as the fetch takes) on every ordinary month change. It is now rendered in every
// state, which puts two new obligations on this component:
//
//   • `year` / `monthIndex` are `number | null` (goo's revised seam @6ddab14). `null` means the cursor has
//     not resolved — pre-mount / SSR / first paint — and it is the reason the old `?? MOCK_YEAR` fallback
//     died: a bar that is always on screen would have made "กรกฎาคม 2569" a permanent, believable lie.
//     A neutral em dash is the honest label; the two pickers are disabled because there is no cursor to
//     move yet. Nothing else changes shape, so resolving the cursor cannot shift the row.
//   • the year list is 21 wide (−10…+10, ฟีม 2026-08-07) instead of 11, which is more than fits a short
//     screen — see the note in Sheet for what that does and does NOT need.
import { useState } from 'react'

const THAI_MONTHS = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม']
const CARD = 'flex h-[62px] shrink-0 items-center rounded-[15px] border border-v3-border-warm bg-white shadow-[0_3px_10px_rgba(26,38,77,0.06)]'

function Chevron() {
  return (
    <svg viewBox="0 0 20 20" className="size-5 shrink-0 text-[#4B5563]" fill="none" aria-hidden>
      <path d="M5 7.5 10 12.5 15 7.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function Sheet({ title, options, current, onPick, onClose }: {
  title: string
  options: { label: string; value: number }[]
  current: number
  onPick: (v: number) => void
  onClose: () => void
}) {
  // 21 years overflow a 70vh sheet on a short phone (content 460px vs 420px at 393×600 / 364px at 393×520),
  // so the panel scrolls — MEASURED, not assumed. I also wrote a scrollIntoView to put the current year in
  // view and then negative-controlled it: with the scroll reset to 0 the current year is STILL fully visible
  // at 852 / 667 / 600 / 520. It is pinned at index 10 of 21 → row 4 of 7, which is above the fold at every
  // height a phone has. The scroll was solving nothing and cost something (it opened the list 27–60px down,
  // clipping 2559–2561 — the "ย้อน 10" half of what ฟีม just asked for), so it is gone. The hooks the
  // control needed (`data-testid="date-sheet"`, `data-current`) stay — they are how the claim was checked.
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30" onClick={onClose} role="dialog" aria-label={title}>
      <div data-testid="date-sheet" className="max-h-[70vh] w-full max-w-md overflow-y-auto rounded-t-[28px] bg-white p-6 pb-10 font-ibm" onClick={(e) => e.stopPropagation()}>
        <p className="mb-4 text-[16px] font-bold leading-6 text-v3-navy">{title}</p>
        <div className="grid grid-cols-3 gap-2">
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              data-current={o.value === current || undefined}
              onClick={() => { onPick(o.value); onClose() }}
              className={`rounded-xl px-2 py-3 text-[14px] font-medium leading-5 ${o.value === current ? 'bg-v3-sapphire text-white' : 'bg-v3-ghost-white text-v3-navy'}`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

/** ย้อน 10 – หน้า 10 (ฟีม 2026-08-07). Was ±5, which could not reach a birthday two elections ago. */
const YEARS_BACK = 10
const YEARS_FORWARD = 10
/** the label when the cursor has not resolved. NOT a month — see the header. */
const UNKNOWN = '—'

export function DateSelector({ year, monthIndex, onToday, onPick }: {
  /** CE year of the cursor — displayed as พ.ศ. (+543). `null` = cursor not resolved yet (pre-mount). */
  year: number | null
  /** 1–12. `null` = cursor not resolved yet (pre-mount). */
  monthIndex: number | null
  onToday: () => void
  onPick: (year: number, monthIndex: number) => void
}) {
  const [open, setOpen] = useState<null | 'month' | 'year'>(null)
  // A cursor of `null` is the ONLY state where this row cannot act, and both halves of it go together —
  // there is no such thing as a known month with an unknown year. One flag, so the row cannot render a
  // live month picker next to a dead year one.
  const known = year !== null && monthIndex !== null
  const years = known ? Array.from({ length: YEARS_BACK + 1 + YEARS_FORWARD }, (_, i) => year - YEARS_BACK + i) : []

  return (
    <div data-testid="date-selector" data-cursor={known ? 'known' : 'unknown'} className="flex items-center gap-2 font-ibm">
      {/* "วันนี้" is the escape hatch this whole PR exists for — it moves goo's CURSOR, not the month, so it
          still works when the month failed to load. It is disabled only while there is no cursor to move
          (goToday is a no-op before mount); a button that looks pressable and does nothing is the bug #191
          went and fixed everywhere else on this screen. */}
      <button type="button" onClick={onToday} disabled={!known} data-testid="date-today" className={`${CARD} justify-center px-4 text-[20px] font-bold leading-7 text-v3-navy disabled:opacity-50`}>
        วันนี้
      </button>

      <button type="button" onClick={() => setOpen('month')} disabled={!known} data-testid="date-month" className={`${CARD} min-w-0 flex-1 justify-between gap-2 px-4 disabled:opacity-50`}>
        <span className="flex min-w-0 flex-col items-start">
          <span className="text-[14px] leading-5 text-v3-text-body">เดือน</span>
          <span className="truncate text-[20px] font-bold leading-7 text-v3-navy">{monthIndex ? THAI_MONTHS[monthIndex - 1] : UNKNOWN}</span>
        </span>
        <Chevron />
      </button>

      <button type="button" onClick={() => setOpen('year')} disabled={!known} data-testid="date-year" className={`${CARD} justify-between gap-2 px-4 disabled:opacity-50`}>
        <span className="flex flex-col items-start">
          <span className="whitespace-nowrap text-[14px] leading-5 text-v3-text-body">ปี (พ.ศ.)</span>
          <span className="text-[20px] font-bold leading-7 text-v3-navy">{year === null ? UNKNOWN : year + 543}</span>
        </span>
        <Chevron />
      </button>

      {known && open === 'month' && (
        <Sheet
          title="เลือกเดือน"
          current={monthIndex}
          options={THAI_MONTHS.map((m, i) => ({ label: m, value: i + 1 }))}
          onPick={(m) => onPick(year, m)}
          onClose={() => setOpen(null)}
        />
      )}
      {known && open === 'year' && (
        <Sheet
          title="เลือกปี (พ.ศ.)"
          current={year}
          options={years.map((y) => ({ label: String(y + 543), value: y }))}
          onPick={(y) => onPick(y, monthIndex)}
          onClose={() => setOpen(null)}
        />
      )}
    </div>
  )
}

export default DateSelector
