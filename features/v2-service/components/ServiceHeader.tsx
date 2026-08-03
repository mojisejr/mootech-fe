// features/v2-service/components/ServiceHeader.tsx — the service-hub top chrome, Figma node 626:4403.
//
// Now a two-line adapter over the shared <AppHeader/> (ฟีม 2026-08-03: "แต่ละหน้าควรจะปรับให้มี convention
// ยังไง แยกเป็น shared component มั๊ย"). It keeps its own name so the screen's import does not move.
//
// The อัพเกรด pill used to be hardcoded on here, because this page had no tier to read. Zone 4 gives it
// one (ServiceHubScreen → useV2Tier), so the flag is now a required prop rather than a constant. It is
// deliberately NOT optional: a caller that forgets it would silently hide the pill from free members, and
// the whole point of this arc is that the free→paid path stops depending on what somebody remembered.
import { AppHeader } from '@/features/v2-shell/components/AppHeader'

export function ServiceHeader({ onAvatar, showUpgrade }: { onAvatar: () => void; showUpgrade: boolean }) {
  return (
    <AppHeader
      testId="service-header"
      title="บริการทั้งหมด"
      showUpgrade={showUpgrade}
      onAvatar={onAvatar}
      className="items-center py-4"
    />
  )
}
