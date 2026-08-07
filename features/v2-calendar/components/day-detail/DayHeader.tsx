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
// ฟีม 2026-08-07: "เอา header เหมือนปฏิทินดวงเลย" — so the light-blue gradient strip and its 20px bottom
// corners are gone. It was this one screen's private chrome: every other v2 page (home · service · ปฏิทินดวง)
// puts <AppHeader/> straight on the page background, and a child screen announcing itself with a different
// coloured lid reads as a different app, not as a deeper level of the same one.
// Dropping the strip HERE does not close the light-blue-gradient debt — the notifications screen still
// carries the identical inline gradient. This screen only ever held a copy of that chrome; one of the two
// sites is gone, the debt is not. Don't read "this closes the gradient debt" into this change.
//
// What deliberately did NOT change: the back chevron (this is a child screen and must return to the month),
// and the bell + avatar cluster, which ฟีม locked as identical app-wide on 2026-08-03.
import { AppHeader } from '@/features/v2-shell/components/AppHeader'

// `showUpgrade` is a pass-through, deliberately with no default: AppHeader's contract is that only an
// explicit `true` renders the pill, so an unknown tier keeps it hidden rather than showing an upsell to
// someone who may already have paid. Figma Free-2 375:11286 has the pill; Paid-2 634:8194 does not.
export function DayHeader({ showUpgrade }: { showUpgrade?: boolean }) {
  // No subtitle, and that is a decision rather than an omission (บอง left it to me). ปฏิทินดวง's subtitle
  // ("ฤกษ์ดี วันมงคล ดิถีจีนรายวัน") frames a whole section. This screen is about ONE day, and that day is
  // already stated in full 145px below — "วันนี้ · อังคารที่ 14 กรกฎาคม 2569" — bigger, next to the ring it
  // belongs to. Repeating it in the header prints the same fact twice in one screenful, in the weaker of the
  // two places; anything else there would be filler. One line to add back if ฟีม disagrees.
  //
  // `items-center` (not ปฏิทินดวง's `items-start`): that page top-aligns a two-line title block against the
  // 40px tools. Here the left is a single line beside a 36px chevron, so centring is what keeps the chevron,
  // the title and the bell on one optical line. Same padding as ปฏิทินดวง otherwise.
  return (
    <AppHeader testId="day-header" title="รายละเอียดวัน" backHref="/v2/calendar" showUpgrade={showUpgrade} className="items-center px-4 pb-2 pt-4" />
  )
}
