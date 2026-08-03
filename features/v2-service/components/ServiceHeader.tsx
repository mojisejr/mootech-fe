// features/v2-service/components/ServiceHeader.tsx — the service-hub top chrome, Figma node 626:4403.
//
// Now a two-line adapter over the shared <AppHeader/> (ฟีม 2026-08-03: "แต่ละหน้าควรจะปรับให้มี convention
// ยังไง แยกเป็น shared component มั๊ย"). It keeps its own name so the screen's import does not move.
//
// The อัพเกรด pill: this page has always shown it unconditionally, and it still does — the page has no tier
// on hand, and quietly DROPPING it here would be a silent behaviour change smuggled inside a refactor.
// Wiring the real tier through the shell (so it hides for paid members) is PR4 / Zone 4, where ฟีม's free-vs-
// paid split is the subject rather than a side effect.
import { AppHeader } from '@/features/v2-shell/components/AppHeader'

export function ServiceHeader({ onAvatar }: { onAvatar: () => void }) {
  return (
    <AppHeader
      testId="service-header"
      title="บริการทั้งหมด"
      showUpgrade
      onAvatar={onAvatar}
      className="items-center py-4"
    />
  )
}
