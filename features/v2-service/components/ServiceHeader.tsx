// features/v2-service/components/ServiceHeader.tsx — the service-hub top chrome, Figma node 626:4403.
//
// Now a two-line adapter over the shared <AppHeader/> (ฟีม 2026-08-03: "แต่ละหน้าควรจะปรับให้มี convention
// ยังไง แยกเป็น shared component มั๊ย"). It keeps its own name so the screen's import does not move.
//
// The อัพเกรด pill used to be hardcoded on here, because this page had no tier to read. Zone 4 gives it
// one (ServiceHubScreen → useV2Tier), so the flag is now a required prop rather than a constant. It is
// deliberately NOT optional: a caller that forgets it would silently hide the pill from free members, and
// the whole point of this arc is that the free→paid path stops depending on what somebody remembered.
// #384 keeps it required for the same reason, only the TYPE widened: the hook's verdict travels whole
// (isPaid true/false/null, plus the tier name once #383 lands) instead of being flattened into a boolean here.
import { AppHeader } from '@/features/v2-shell/components/AppHeader'
import type { MembershipLike } from '@/features/v2-shell/header-badge'

export function ServiceHeader({ onAvatar, membership }: { onAvatar: () => void; membership: MembershipLike }) {
  return (
    <AppHeader
      testId="service-header"
      title="บริการทั้งหมด"
      membership={membership}
      onAvatar={onAvatar}
      className="items-center py-4"
    />
  )
}
