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
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30" onClick={onClose} role="dialog" aria-label={title}>
      <div className="max-h-[70vh] w-full max-w-md overflow-y-auto rounded-t-[28px] bg-white p-6 pb-10 font-ibm" onClick={(e) => e.stopPropagation()}>
        <p className="mb-4 text-[16px] font-bold leading-6 text-v3-navy">{title}</p>
        <div className="grid grid-cols-3 gap-2">
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
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

export function DateSelector({ year, monthIndex, onToday, onPick }: {
  /** CE year of the cursor — displayed as พ.ศ. (+543) */
  year: number
  /** 1–12 */
  monthIndex: number
  onToday: () => void
  onPick: (year: number, monthIndex: number) => void
}) {
  const [open, setOpen] = useState<null | 'month' | 'year'>(null)
  // ±5 years around the cursor — enough to plan ahead or look back without an infinite list
  const years = Array.from({ length: 11 }, (_, i) => year - 5 + i)

  return (
    <div data-testid="date-selector" className="flex items-center gap-2 font-ibm">
      <button type="button" onClick={onToday} data-testid="date-today" className={`${CARD} justify-center px-4 text-[20px] font-bold leading-7 text-v3-navy`}>
        วันนี้
      </button>

      <button type="button" onClick={() => setOpen('month')} data-testid="date-month" className={`${CARD} min-w-0 flex-1 justify-between gap-2 px-4`}>
        <span className="flex min-w-0 flex-col items-start">
          <span className="text-[14px] leading-5 text-v3-text-body">เดือน</span>
          <span className="truncate text-[20px] font-bold leading-7 text-v3-navy">{THAI_MONTHS[monthIndex - 1]}</span>
        </span>
        <Chevron />
      </button>

      <button type="button" onClick={() => setOpen('year')} data-testid="date-year" className={`${CARD} justify-between gap-2 px-4`}>
        <span className="flex flex-col items-start">
          <span className="whitespace-nowrap text-[14px] leading-5 text-v3-text-body">ปี (พ.ศ.)</span>
          <span className="text-[20px] font-bold leading-7 text-v3-navy">{year + 543}</span>
        </span>
        <Chevron />
      </button>

      {open === 'month' && (
        <Sheet
          title="เลือกเดือน"
          current={monthIndex}
          options={THAI_MONTHS.map((m, i) => ({ label: m, value: i + 1 }))}
          onPick={(m) => onPick(year, m)}
          onClose={() => setOpen(null)}
        />
      )}
      {open === 'year' && (
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
