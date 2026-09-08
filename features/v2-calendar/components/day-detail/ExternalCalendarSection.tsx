// เพิ่มปฏิทินภายนอก (Figma 375:11286) — 3 destination toggles under the yam picker in the save sheet.
// PRESENTATIONAL (no hooks): the page owns the {mumate,google,apple} truth and passes value + onToggle, so
// this can be fed every combination in a preview/unit without a browser — same contract as SaveSheet itself.
//
//   • mumate  → the in-app PWA push (POST /api/v2/reminders). Default ON.
//   • google  → opens a Google Calendar pre-filled event on save (lib/v2/external-calendar).
//   • apple   → downloads an .ics on save.
import type { ReminderDestination } from '../../types'

type Dests = Record<ReminderDestination, boolean>

const ROWS: { key: ReminderDestination; title: string; subtitle: string; icon: JSX.Element }[] = [
  {
    key: 'mumate',
    title: 'แจ้งเตือนในแอป Mumate',
    subtitle: 'แจ้งเตือนพร้อม notification',
    icon: (
      <span className="grid size-9 place-items-center rounded-full bg-v3-sapphire text-white">
        <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden>
          <path d="M10 2.5a4.5 4.5 0 0 0-4.5 4.5c0 3.5-1.5 4.75-1.5 4.75h12s-1.5-1.25-1.5-4.75A4.5 4.5 0 0 0 10 2.5ZM8.5 15.5a1.5 1.5 0 0 0 3 0" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    ),
  },
  {
    key: 'google',
    title: 'Google ปฏิทิน',
    subtitle: 'เพิ่มเป็นกิจกรรมในปฏิทิน',
    icon: (
      <span className="grid size-9 place-items-center rounded-full bg-white ring-1 ring-v3-border-warm">
        <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
          <path fill="#4285F4" d="M45.1 24.5c0-1.6-.1-2.8-.4-4H24v7.2h11.9c-.2 1.9-1.5 4.8-4.4 6.7l6.8 5.3c4-3.7 6.8-9.2 6.8-15.2Z" />
          <path fill="#34A853" d="M24 46c5.9 0 10.9-1.9 14.5-5.3l-6.8-5.3c-1.9 1.3-4.4 2.2-7.7 2.2-5.9 0-10.9-4-12.7-9.5l-7 5.4C7.9 40.9 15.4 46 24 46Z" />
          <path fill="#FBBC05" d="M11.3 28.1c-.5-1.3-.7-2.7-.7-4.1s.3-2.8.7-4.1l-7-5.4C3.1 17.3 2.4 20.6 2.4 24s.7 6.7 1.9 9.5l7-5.4Z" />
          <path fill="#EA4335" d="M24 10.4c3.3 0 5.5 1.4 6.8 2.6l6-5.9C33 3.7 29.9 2 24 2 15.4 2 7.9 7.1 4.3 14.5l7 5.4C13.1 14.4 18.1 10.4 24 10.4Z" />
        </svg>
      </span>
    ),
  },
  {
    key: 'apple',
    title: 'Apple Calendar',
    subtitle: 'เพิ่มเป็นกิจกรรมในปฏิทิน',
    icon: (
      <span className="grid size-9 place-items-center rounded-full bg-v3-navy text-white">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M16.4 12.7c0-2.3 1.9-3.4 2-3.5-1.1-1.6-2.8-1.8-3.4-1.8-1.4-.1-2.8.8-3.5.8s-1.8-.8-3-.8c-1.5 0-3 .9-3.8 2.3-1.6 2.8-.4 7 1.2 9.3.8 1.1 1.7 2.3 2.9 2.3 1.2 0 1.6-.7 3-.7s1.8.7 3 .7 2-1.1 2.8-2.2c.9-1.3 1.2-2.5 1.3-2.6-.1 0-2.5-1-2.2-3.8ZM14.1 5.9c.6-.8 1.1-1.9.9-3-1 0-2.1.7-2.8 1.5-.6.7-1.1 1.8-1 2.9 1.1.1 2.2-.6 2.9-1.4Z" />
        </svg>
      </span>
    ),
  },
]

export function ExternalCalendarSection({ value, onToggle }: { value: Dests; onToggle: (d: ReminderDestination) => void }) {
  return (
    <div className="rounded-[18px] bg-white p-4 shadow-[0px_4px_14px_0px_rgba(26,38,77,0.06)]">
      <p className="mb-1 text-[18px] font-bold leading-6 text-v3-navy">เพิ่มปฏิทินภายนอก</p>
      <p className="mb-3 text-[13px] leading-5 text-v3-text-body">เลือกได้มากกว่าหนึ่ง เพื่อให้เตือนครบทุกที่</p>
      <div className="flex flex-col gap-2">
        {ROWS.map((r) => {
          const on = !!value[r.key]
          return (
            <div key={r.key} data-testid={`extcal-row-${r.key}`} className="flex items-center gap-3 rounded-[12px] bg-v3-ghost-white p-3">
              {r.icon}
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-bold leading-5 text-v3-navy">{r.title}</span>
                <span className="block truncate text-[13px] leading-[18px] text-v3-text-body">{r.subtitle}</span>
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={on}
                aria-label={r.title}
                data-testid={`extcal-toggle-${r.key}`}
                onClick={() => onToggle(r.key)}
                className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${on ? 'bg-v3-sapphire' : 'bg-v3-border-warm-2'}`}
              >
                <span className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition-all ${on ? 'left-[22px]' : 'left-0.5'}`} />
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
