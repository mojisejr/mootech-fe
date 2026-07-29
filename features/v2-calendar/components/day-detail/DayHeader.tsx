// §1 — top header: back → month view, title "รายละเอียดวัน", the notification bell, and the avatar. Light-blue
// glow top-right (Figma). The bell is the ENTRY-POINT to the notifications list (→ /v2/calendar/notifications;
// Mate AI lives in the bottom CalendarMenu). Bell + avatar now render via the SHARED TopBar* components
// (ฟีม: one bell/avatar reused everywhere) — the 'mate' skin reproduces this header's EXACT pixels; behaviour
// (bell = href → notifications, avatar = decorative) is unchanged.
import Link from 'next/link'
import { TopBarBell } from '@/features/v2-shell/components/TopBarBell'
import { TopBarAvatar } from '@/features/v2-shell/components/TopBarAvatar'

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

      <TopBarBell variant="mate" href="/v2/calendar/notifications" testId="header-notif-bell" />
      <TopBarAvatar variant="mate" />
    </header>
  )
}
