// §1 — top header: back → month view, title "รายละเอียดวัน", the notification bell, and the avatar. Light-blue
// glow top-right (Figma). Phase 7 A1: the bell is the ENTRY-POINT to the notifications list (was a static
// Mate AI glyph → now links to /v2/calendar/notifications; Mate AI lives in the bottom CalendarMenu).
import Link from 'next/link'

export function DayHeader() {
  return (
    <header
      className="flex items-center gap-3 rounded-b-[20px] px-4 pb-3 pt-2"
      style={{ background: 'linear-gradient(105deg, #FFFFFF 40%, #C9E4F4 100%)' }}
    >
      <Link href="/v2/calendar" aria-label="ย้อนกลับ" className="grid size-9 place-items-center rounded-full text-v3-navy">
        <svg viewBox="0 0 20 20" className="size-6" fill="none" aria-hidden>
          <path d="M12.5 5 7.5 10l5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </Link>
      <h1 className="flex-1 text-xl font-extrabold text-v3-navy">รายละเอียดวัน</h1>

      <Link href="/v2/calendar/notifications" aria-label="การแจ้งเตือน" data-testid="header-notif-bell" className="grid size-10 place-items-center rounded-full bg-gradient-to-br from-v3-mate-teal to-v3-mate-purple">
        <svg viewBox="0 0 24 24" className="size-6 text-v3-lime" fill="none" aria-hidden>
          <path d="M12 3.5a5 5 0 0 1 5 5v3l1.4 2.4a1 1 0 0 1-.86 1.5H6.46a1 1 0 0 1-.86-1.5L7 11.5v-3a5 5 0 0 1 5-5Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
          <path d="M10 18a2 2 0 0 0 4 0" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </Link>

      <span aria-hidden className="size-10 shrink-0 rounded-full bg-gradient-to-br from-v3-pastel-blue to-v3-mate-purple ring-2 ring-white" />
    </header>
  )
}
