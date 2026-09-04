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
//   2. the pill's input is not defaulted. An undetermined membership renders NO pill — never a pill "just
//      in case". Showing an upsell to someone who already paid is the failure mode that actually costs us,
//      and a default-on flag is exactly the silent-default class we closed in the compat calculator.
//      #384 replaced the boolean `showUpgrade` with `membership` for exactly this reason: a two-valued type
//      had no room for "ไม่รู้" and spent it as "not paid" on every error (see header-badge.ts).
//
// The AVATAR follows ฟีม's ruling that the bell/avatar look must be identical everywhere ("มันควรจะเป็นแบบ
// นั้น") — one skin, no per-page variants. The ACTION stays with the page: pass `onAvatar` and it is a
// button; pass nothing and it renders the same pixels as a non-interactive tile. A control that looks
// pressable and does nothing is worse than one that does not invite the press.
import Link from 'next/link'
import type { ReactNode } from 'react'
import { TopBarBell } from './TopBarBell'
import { TopBarAvatar } from './TopBarAvatar'
import { SHOP_HREF } from '@/features/v2-shop/upgrade-cta'
import { ACCOUNT_HREF } from '@/features/v2-account/account-cta'
import { headerBadge, type MembershipLike } from '../header-badge'

export type AppHeaderProps = {
  /** left: the page title (Heading/H1 24/32 navy — Figma) */
  title?: string
  /** left: optional second line under the title (Body 14/20 #464646 — Figma) */
  subtitle?: string
  /** left: a custom block that replaces title/subtitle entirely (home's Structure A greeting) */
  left?: ReactNode
  /** left: renders a back chevron before the title (day detail · notifications) */
  backHref?: string
  /** right: who the viewer is. Absent / `isPaid: null` = not determined → NO pill at all (never a guess).
   *  Replaces the old `showUpgrade?: boolean`, which could not express "ไม่รู้" and therefore spent it as
   *  "not paid" — see features/v2-shell/header-badge.ts for the bug that cost. */
  membership?: MembershipLike | null
  /** right: may THIS screen show the อัพเกรด CTA? Screen policy, not user fact (#384). Default true; the
   *  shop screen passes false (the CTA's destination IS that screen) and so does the notifications screen
   *  (บอง 2026-08-22: showing the LEVEL there is in scope, opening a NEW sales surface is not). A paid
   *  member's level badge is unaffected by this flag — it is not a sales control. */
  upgradeCta?: boolean
  /** right: may THIS screen's level badge navigate to /v2/account (#365)? Screen policy, like `upgradeCta`.
   *  Default true; /v2/account itself passes false so the badge does not link to the page being viewed.
   *  ⚠️ This is NOT a user fact and must never be derived from one — a paid member on /v2/account still SEES
   *  their badge, it simply does not navigate. */
  tierLink?: boolean
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

// Figma 636:12792 (Button/Contained). ฟีม 2026-08-03 said this would go to payment "แต่ตอนนี้ ยังไม่ต้องไป
// ไหนก่อน", and the comment here predicted "Turning it into a Link is then a one-line change."
// #359 built the destination, so this is now that Link. Same pixels — only the element and where the tap
// lands change. It was a ComingSoonAction in between (ฟีม 2026-08-06) so the tap answered instead of being
// eaten; announcing is no longer the honest response now that there is a screen to show.
function UpgradeBadge() {
  return (
    <Link
      href={SHOP_HREF}
      data-testid="header-upgrade"
      aria-label="อัพเกรด"
      className="grid h-8 w-[84px] shrink-0 place-items-center rounded-lg bg-v3-grade-yellow text-[16px] font-medium leading-6 text-v3-cyan drop-shadow-[0_4px_8px_rgba(117,227,235,0.5)]"
    >
      อัพเกรด
    </Link>
  )
}

// The SAME 84×32 slot as the อัพเกรด pill, deliberately down to the drop-shadow.
//
// 🔴 DELIBERATE DIFFERENCE, LOGGED (ฟีม via บอง 2026-08-22): this keeps the CTA's cyan glow — a pressable
// affordance — on a control whose destination (จอ "สิทธิ์ของฉัน", mootech-fe#365) does not exist yet, so the
// tap answers "เร็วๆ นี้". Keeping the pixels identical is what makes "the header did not move" provable at
// 0 px² across all six screens; whether a STATUS badge should speak the same visual language as a SALES
// badge is a design question that needs its destination built first. mootech-fe#365 owns changing both.
//
// Widths measured, not assumed (#384, IBM Plex Sans Thai 16/500): อัพเกรด 55.13px · สมาชิก 46.55px ·
// PLUS 38.31px · PRO 31.75px. The longest of the five is the word that already ships, so every new state is
// NARROWER than the incumbent inside the same 84px box — nothing can overflow or clip.
// #365 — the destination exists now, so the tap navigates instead of announcing. The class list is a const
// because BOTH branches must paint the identical 84×32 box: "the header did not move" is provable at 0 px²
// only if the element swap changes nothing but the element.
const TIER_BADGE_CLASS =
  'grid h-8 w-[84px] shrink-0 place-items-center rounded-lg bg-v3-grade-yellow text-[16px] font-medium leading-6 text-v3-cyan drop-shadow-[0_4px_8px_rgba(117,227,235,0.5)]'

// `linked` is the SCREEN's policy, exactly like `upgradeCta` above it, and for the same reason #384 split
// that one out: /v2/account is where this badge POINTS, so on that screen it would point at itself. ShopScreen
// already closed this shape for the seller pill (ShopScreen.tsx:44). A control that navigates to the page you
// are already on is not a no-op — it is a tap that answers by doing nothing visible.
function TierBadge({ label, linked }: { label: string; linked: boolean }) {
  if (!linked) {
    // Same pixels, no anchor: nothing to focus, nothing to click, nothing that lies about being pressable.
    return (
      <div data-testid="header-tier" aria-label={`ระดับสมาชิก ${label}`} className={TIER_BADGE_CLASS}>
        {label}
      </div>
    )
  }
  return (
    <Link href={ACCOUNT_HREF} data-testid="header-tier" aria-label={`ระดับสมาชิก ${label}`} className={TIER_BADGE_CLASS}>
      {label}
    </Link>
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
export function HeaderTools({ membership, upgradeCta = true, tierLink = true, onAvatar, avatarName, avatarPictureUrl = null, bellHref = '/v2/calendar/notifications' }:
  Pick<AppHeaderProps, 'membership' | 'upgradeCta' | 'tierLink' | 'onAvatar' | 'avatarName' | 'avatarPictureUrl' | 'bellHref'>) {
  const badge = headerBadge(membership, { upgradeCta })
  return (
    <div data-testid="header-tools" className="flex shrink-0 items-center gap-2">
      {badge.kind === 'upgrade' && <UpgradeBadge />}
      {badge.kind === 'tier' && <TierBadge label={badge.label} linked={tierLink} />}
      <TopBarBell variant="solid" href={bellHref} />
      {/* 🔴 avatar ปลายทางมีจริงแล้ว (2026-09-04): หน้าที่ไม่ส่ง onAvatar (ร้านค้า/checkout/ปฏิทิน/แจ้งเตือน)
          เดิมตกไปที่ toast "โปรไฟล์กำลังจะมา เร็วๆ นี้" ซึ่งโกหกตั้งแต่ /v2/account เกิด — ตอนนี้ default
          คือพาไปโปรไฟล์ ส่วน home/service ยังผูก onAvatar เปิดเมนูออกจากระบบเหมือนเดิม (ชนะเสมอเมื่อส่งมา) */}
      <TopBarAvatar variant="sapphire" name={avatarName} pictureUrl={avatarPictureUrl} onClick={onAvatar} href={onAvatar ? undefined : '/v2/account'} />
    </div>
  )
}

export function AppHeader({
  title,
  subtitle,
  left,
  backHref,
  membership,
  upgradeCta,
  tierLink,
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
      <HeaderTools membership={membership} upgradeCta={upgradeCta} tierLink={tierLink} onAvatar={onAvatar} avatarName={avatarName} avatarPictureUrl={avatarPictureUrl} bellHref={bellHref} />
    </header>
  )
}

export default AppHeader
