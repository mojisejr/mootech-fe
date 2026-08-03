// §1 — the day-detail top bar: back → month view, title "รายละเอียดวัน", bell, avatar.
//
// ฟีม 2026-08-03 (คำถาม A): "กระดิ่ง + avatar รวมเป็นแบบเดียวทั้ง app มันควรจะเป็นแบบนั้น" — so the
// calendar-only 'mate' skins are gone from here. The bell is the same cyan bell as home/service, and the
// avatar is the same sapphire tile instead of the decorative gradient circle that could not be tapped.
//
// The page has no user row on hand, so the avatar shows its letter fallback and stays non-interactive
// (AppHeader renders a <span>, not a dead button). Giving the calendar flow the real picture + a menu is a
// data wiring job, logged as A2 — not something to fake with a placeholder that looks tappable.
//
// The light-blue gradient strip is this screen's own chrome and is preserved verbatim.
// ANCHOR: inline-gradient — bug-ledger#inline-hex-gradient-tech-debt (ตู๋ · D2): multi-stop hex gradient kept
// as-is; #C9E4F4 IS the v3-pastel-blue token value.
import { AppHeader } from '@/features/v2-shell/components/AppHeader'

// `showUpgrade` is a pass-through, deliberately with no default: AppHeader's contract is that only an
// explicit `true` renders the pill, so an unknown tier keeps it hidden rather than showing an upsell to
// someone who may already have paid. Figma Free-2 375:11286 has the pill; Paid-2 634:8194 does not.
export function DayHeader({ showUpgrade }: { showUpgrade?: boolean }) {
  return (
    <div style={{ background: 'linear-gradient(105deg, #FFFFFF 40%, #C9E4F4 100%)' }} className="rounded-b-[20px]">
      <AppHeader testId="day-header" title="รายละเอียดวัน" backHref="/v2/calendar" showUpgrade={showUpgrade} className="items-center px-4 pb-3 pt-2" />
    </div>
  )
}
