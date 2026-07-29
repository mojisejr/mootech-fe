// features/v2-service/components/ServiceHeader.tsx — the service-hub top chrome, Figma node 626:4403.
// Row: H1 "บริการทั้งหมด" (navy bold 24/32) · "อัพเกรด" pill (grade-yellow, cyan label) · bell · avatar.
//
// bell + avatar are the SHARED TopBar* components (ฟีม: one bell/avatar reused everywhere). Behaviour
// (ฟีม's default): bell → /v2/calendar/notifications; avatar → the logout menu (onAvatar, wired by the
// screen). 'solid' skin = home's canonical cyan bell + sapphire letter-avatar (no user on this page → 'F').
import { TopBarBell } from '@/features/v2-shell/components/TopBarBell'
import { TopBarAvatar } from '@/features/v2-shell/components/TopBarAvatar'

export function ServiceHeader({ onAvatar }: { onAvatar: () => void }) {
  return (
    <header data-testid="service-header" className="flex items-center gap-2 py-4 font-ibm">
      <h1 className="min-w-0 flex-1 text-[24px] font-bold leading-8 text-v3-navy">บริการทั้งหมด</h1>
      {/* อัพเกรด pill — decorative chrome (Figma); no payment flow on this page */}
      <span className="shrink-0 rounded-lg bg-v3-grade-yellow px-3 py-1.5 text-[16px] font-medium leading-6 text-v3-cyan shadow-sm">
        อัพเกรด
      </span>
      <TopBarBell variant="solid" href="/v2/calendar/notifications" />
      <TopBarAvatar variant="sapphire" onClick={onAvatar} />
    </header>
  )
}
