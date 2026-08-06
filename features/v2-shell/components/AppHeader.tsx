// features/v2-shell/components/AppHeader.tsx — THE v2 top bar. One component, every screen.
//
// ฟีม 2026-08-03, reading three Figma headers side by side: "มันเปลี่ยนแค่ข้อความทางซ้าย … แต่ทุกอย่างทางขวา
// เหมือนเดิม … คุณลองเช็คดูสิว่าแต่ละหน้าควรจะปรับให้มี convention ยังไง แยกเป็น shared component มั๊ย".
// He read it correctly — `get_design_context` on all three says the same thing:
//
//   home     402:23220 — greeting + element line │ bell 40 · avatar 40
//   service  626:4403  — "บริการทั้งหมด"         │ อัพเกรด 84×32 · bell · avatar
//   calendar 368:9807  — "ปฏิทินดวง" + subtitle   │ อัพเกรด 84×32 · bell · avatar
//
// LEFT varies, RIGHT is the same cluster in the same order at the same sizes with the same 8px gaps, pinned
// right. So the shared thing is not "a header" — it is THE RIGHT CLUSTER. This component owns it and leaves
// the left as a slot, which is why home can keep a layout Figma never drew (below) without forking anything.
//
// WHAT THIS FIXES (measured, not assumed):
//   • /v2/calendar had NO header at all — no title, no bell, no avatar. Not a drifted header: a missing one.
//   • the อัพเกรด pill was three different pills. Figma (626:12792) is bg #F1FF75 · 84×32 · r8 · text #1B9AAF
//     16/24 medium · drop-shadow 0 4 8 rgba(117,227,235,.5). home shipped lime + navy + rounded-full.
//
// TWO DELIBERATE DEVIATIONS FROM FIGMA — both are older human decisions, recorded so a future pass does not
// "fix" them back into bugs:
//   1. home's left is Structure A (ฟีม 2026-07-26): a small "สวัสดีคุณ" label row, then the NAME on its own
//      full-width line. Figma draws one line because its mock name is short; a real long name would be cut,
//      and ฟีม ruled the name must never truncate. The instruction outranks the drawing.
//   2. `showUpgrade` is not defaulted. An undefined tier renders NO pill — never a pill "just in case".
//      Showing an upsell to someone who already paid is the failure mode that actually costs us, and a
//      default-on flag is exactly the silent-default class we closed in the compat calculator. Pages that
//      know their tier pass it; wiring tier into the shell for the whole calendar flow is PR4 (Zone 4).
//
// The AVATAR follows ฟีม's ruling that the bell/avatar look must be identical everywhere ("มันควรจะเป็นแบบ
// นั้น") — one skin, no per-page variants. The ACTION stays with the page: pass `onAvatar` and it is a
// button; pass nothing and it renders the same pixels as a non-interactive tile. A control that looks
// pressable and does nothing is worse than one that does not invite the press.
import Link from 'next/link'
import type { ReactNode } from 'react'
import { TopBarBell } from './TopBarBell'
import { TopBarAvatar } from './TopBarAvatar'
import { ComingSoonAction } from './ComingSoon'

export type AppHeaderProps = {
  /** left: the page title (Heading/H1 24/32 navy — Figma) */
  title?: string
  /** left: optional second line under the title (Body 14/20 #464646 — Figma) */
  subtitle?: string
  /** left: a custom block that replaces title/subtitle entirely (home's Structure A greeting) */
  left?: ReactNode
  /** left: renders a back chevron before the title (day detail · notifications) */
  backHref?: string
  /** right: the อัพเกรด pill. ONLY `true` shows it — undefined means "tier unknown" → hidden. */
  showUpgrade?: boolean
  /** right: avatar tap. Absent → the avatar renders non-interactive (same pixels, no dead button). */
  onAvatar?: () => void
  avatarName?: string
  avatarPictureUrl?: string | null
  /** right: where the bell goes (default = the full notifications page, ฟีม 2026-07-29) */
  bellHref?: string
  /** page chrome + vertical alignment. NOTE alignment lives here on purpose: the base class list must not
   *  also set `items-*`, or a caller passing `items-center` would race it in the stylesheet (whichever
   *  Tailwind emits last wins — not whichever you wrote last). */
  className?: string
  testId?: string
}

// Figma 636:12792 (Button/Contained). NOT a <button>: ฟีม 2026-08-03 — "เดี๋ยวมันจะต้องไป payment (v2) ครับ
// แต่ตอนนี้ ยังไม่ต้องไปไหนก่อน". Until that route exists this is a badge, not a control, so it cannot read
// as a button that silently does nothing. Turning it into a Link is then a one-line change.
// ฟีม 2026-08-06: the pill answers now instead of eating the tap. Same pixels — only the element and the
// response change (see ComingSoon.tsx for why silence read as broken rather than as unbuilt).
function UpgradeBadge() {
  return (
    <ComingSoonAction
      testId="header-upgrade"
      label="อัพเกรด"
      message="ระบบสมาชิกกำลังจะมา เร็วๆ นี้"
      className="grid h-8 w-[84px] shrink-0 place-items-center rounded-lg bg-v3-grade-yellow text-[16px] font-medium leading-6 text-v3-cyan drop-shadow-[0_4px_8px_rgba(117,227,235,0.5)]"
    >
      อัพเกรด
    </ComingSoonAction>
  )
}

function BackLink({ href }: { href: string }) {
  return (
    <Link href={href} aria-label="ย้อนกลับ" data-testid="header-back" className="-ml-1 grid size-9 shrink-0 place-items-center rounded-full text-v3-navy">
      <svg viewBox="0 0 20 20" className="size-6" fill="none" aria-hidden>
        <path d="M12.5 5 7.5 10l5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </Link>
  )
}

// THE right cluster, exported on its own — because it is the actual shared thing (see the note at the top).
// home needs it INSIDE its first row while its name and element line keep the full column width, so it
// composes this directly instead of the <AppHeader/> row; every other screen gets it via <AppHeader/>.
export function HeaderTools({ showUpgrade, onAvatar, avatarName, avatarPictureUrl = null, bellHref = '/v2/calendar/notifications' }:
  Pick<AppHeaderProps, 'showUpgrade' | 'onAvatar' | 'avatarName' | 'avatarPictureUrl' | 'bellHref'>) {
  return (
    <div data-testid="header-tools" className="flex shrink-0 items-center gap-2">
      {showUpgrade === true && <UpgradeBadge />}
      <TopBarBell variant="solid" href={bellHref} />
      <TopBarAvatar variant="sapphire" name={avatarName} pictureUrl={avatarPictureUrl} onClick={onAvatar} />
    </div>
  )
}

export function AppHeader({
  title,
  subtitle,
  left,
  backHref,
  showUpgrade,
  onAvatar,
  avatarName,
  avatarPictureUrl = null,
  bellHref = '/v2/calendar/notifications',
  className = 'items-start px-4 pb-6 pt-4',
  testId = 'app-header',
}: AppHeaderProps) {
  return (
    <header data-testid={testId} className={`flex gap-2 font-ibm ${className}`}>
      {backHref && <BackLink href={backHref} />}
      {left ?? (
        // Figma 375:11274 — title 24/32 bold navy, subtitle 14/20 medium #464646, 8px apart.
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          {title && <h1 data-testid="header-title" className="break-words text-[24px] font-bold leading-8 text-v3-navy">{title}</h1>}
          {subtitle && <p data-testid="header-subtitle" className="text-[14px] font-medium leading-5 text-v3-text-body">{subtitle}</p>}
        </div>
      )}
      {/* THE right cluster — order and sizes are the invariant run-app-header.ts owns */}
      <HeaderTools showUpgrade={showUpgrade} onAvatar={onAvatar} avatarName={avatarName} avatarPictureUrl={avatarPictureUrl} bellHref={bellHref} />
    </header>
  )
}

export default AppHeader
