// MuMate v2 — THE bottom menu. One component, four states, every screen (Figma menu 461:3224).
//
// PR2 of the nav clean-up (ฟีม 2026-08-03, ทาง ก). Before this there were TWO "shared" bottom navs that had
// drifted apart — v2-shell/Menubar (icons, no Mate AI, 1 state) on the service screens, and v2-home/CalendarMenu
// (Mate AI, NO icons, 4 states) on home + the calendar flow — so the menu genuinely looked different depending
// on where you were, and NEITHER matched Figma. PR1 (#163) fixed the symptoms and gave them a shared Mate AI
// button; this file is now the single implementation, and CalendarMenu re-exports it so goo's menu-state
// contract and CalendarShell keep working untouched.
//
// STATES (contract owned by goo in features/v2-calendar/menu-state.ts — Figma-verified there, not re-derived):
//   default     4 tabs + Mate AI              — home · calendar month
//   primary-cta CTA button + Mate AI          — day detail, unsaved
//   saved       "✓ …" button + Mate AI        — day detail, saved
//   form        full-width button, NO Mate AI — the save sheet (Figma has no bottom menu there)
//
// ICONS are the real Figma glyphs (exported from the Menubar instance 469:3671) and paint with currentColor,
// so active (lime on sapphire) and inactive (muted) come from one class instead of two icon sets. Home was
// text-only before — gaining the icon row is the INTENDED Figma-fidelity change of this PR.
//
// WIDTH: tabs are min-w-0 flex-1 and the type steps down (14 → 12 <384 → 11 <340) so no label is ever cut and
// the bar never overflows a narrow screen — the fixed-layer clipping class that run-nav-consistency.ts owns.
import Link from 'next/link'
import { useRouter } from 'next/router'
import type { ReactNode } from 'react'
import { MateAIButton } from './MateAIButton'

export type MenubarState = 'default' | 'primary-cta' | 'saved' | 'form'

const ICON = 'h-4 w-4 shrink-0'
const IconHome = () => (
  <svg viewBox="0 0 14.3333 15.0094" className={ICON} fill="currentColor" aria-hidden>
    <path fillRule="evenodd" clipRule="evenodd" d="M8.81267 0.618337C7.8702 -0.206112 6.46313 -0.206113 5.52066 0.618337L1.08173 4.50134C0.39432 5.10266 0 5.97151 0 6.88478V12.5094C0 13.8902 1.11929 15.0094 2.5 15.0094H11.8333C13.2141 15.0094 14.3333 13.8902 14.3333 12.5094V6.88478C14.3333 5.97151 13.939 5.10266 13.2516 4.50135L8.81267 0.618337ZM4.60777 9.05931C4.48921 8.80991 4.19092 8.70384 3.94153 8.82238C3.69213 8.94098 3.58607 9.23924 3.70464 9.48864C4.01596 10.1435 4.50663 10.6966 5.11969 11.0838C5.73275 11.471 6.44307 11.6764 7.16813 11.6761C7.89327 11.6758 8.6034 11.4699 9.21613 11.0822C9.82887 10.6946 10.3191 10.141 10.6299 9.48598C10.7483 9.23644 10.642 8.93824 10.3925 8.81991C10.1431 8.70151 9.84487 8.80778 9.72647 9.05731C9.49673 9.54151 9.1344 9.95064 8.68147 10.2372C8.2286 10.5237 7.70367 10.6759 7.16773 10.6761C6.6318 10.6763 6.1068 10.5245 5.65368 10.2383C5.20055 9.95218 4.83788 9.54331 4.60777 9.05931Z" />
  </svg>
)
const IconService = () => (
  <svg viewBox="0 0 16 16" className={ICON} fill="currentColor" aria-hidden>
    <path d="M13.9872 2.01389C13.4072 1.43389 12.5872 1.20723 11.7939 1.40723L5.26056 3.04056C4.16056 3.31389 3.31389 4.16723 3.04056 5.26056L1.40723 11.8005C1.20723 12.5939 1.43389 13.4139 2.01389 13.9939C2.45389 14.4272 3.03389 14.6672 3.63389 14.6672C3.82056 14.6672 4.01389 14.6472 4.20056 14.5939L10.7405 12.9605C11.8339 12.6872 12.6872 11.8405 12.9605 10.7405L14.5939 4.20056C14.7939 3.40723 14.5672 2.58723 13.9872 2.01389ZM8.00053 10.5872C6.57389 10.5872 5.41389 9.4272 5.41389 8.00053C5.41389 6.57389 6.57389 5.41389 8.00053 5.41389C9.4272 5.41389 10.5872 6.57389 10.5872 8.00053C10.5872 9.4272 9.4272 10.5872 8.00053 10.5872Z" />
  </svg>
)
const IconCalendar = () => (
  <svg viewBox="0 0 18 20" className={ICON} fill="currentColor" aria-hidden>
    <path d="M18 18V4C18 2.897 17.103 2 16 2H14V0H12V2H6V0H4V2H2C0.897 2 0 2.897 0 4V18C0 19.103 0.897 20 2 20H16C17.103 20 18 19.103 18 18ZM6 16H4V14H6V16ZM6 12H4V10H6V12ZM10 16H8V14H10V16ZM10 12H8V10H10V12ZM14 16H12V14H14V16ZM14 12H12V10H14V12ZM16 7H2V5H16V7Z" />
  </svg>
)
const IconShop = () => (
  <svg viewBox="0 0 21.6 19.2" className={ICON} fill="currentColor" aria-hidden>
    <path d="M6.1476 6.3L7.0968 0H2.16L0.0972 5.4C0.0332 5.592 0.0008 5.792 0 6C0 7.3248 1.38 8.4 3.0852 8.4C4.6572 8.4 5.9568 7.4832 6.1476 6.3ZM10.8 8.4C12.504 8.4 13.8852 7.3248 13.8852 6C13.8844 5.9504 13.8824 5.902 13.8792 5.8548L13.2684 0H8.3316L7.7196 5.85L7.7148 6C7.7148 7.3248 9.096 8.4 10.8 8.4ZM16.8 9.6552V14.4H4.8V9.6624C4.2744 9.852 3.696 9.96 3.0852 9.96C2.8512 9.96 2.6244 9.9324 2.4 9.9012V17.52C2.4 18.444 3.1548 19.2 4.0776 19.2H17.52C18.444 19.2 19.2 18.4428 19.2 17.52V9.9024C18.9733 9.93836 18.7443 9.95801 18.5148 9.9612C17.9298 9.9595 17.3495 9.85595 16.8 9.6552ZM21.504 5.4L19.4388 0H14.5032L15.4512 6.2904C15.636 7.4784 16.9356 8.4 18.5148 8.4C20.2188 8.4 21.6 7.3248 21.6 6C21.5992 5.792 21.5672 5.592 21.504 5.4Z" />
  </svg>
)

const TABS: { href: string; label: string; icon: ReactNode }[] = [
  { href: '/v2', label: 'หน้าหลัก', icon: <IconHome /> },
  { href: '/v2/service', label: 'บริการ', icon: <IconService /> },
  { href: '/v2/calendar', label: 'ปฏิทิน', icon: <IconCalendar /> },
  { href: '/v2/shop', label: 'ร้านค้า', icon: <IconShop /> },
]

function isActive(pathname: string, href: string): boolean {
  return href === '/v2' ? pathname === '/v2' : pathname === href || pathname.startsWith(`${href}/`)
}

const NAV = 'fixed inset-x-0 bottom-0 z-40 mx-auto flex max-w-md items-center gap-3.5 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2'

export function Menubar({ state = 'default', ctaLabel, ctaDisabled = false, onCta }: {
  state?: MenubarState
  ctaLabel?: string
  /** #343 — ปิดปุ่มด้วยเหตุของหน้าเพจ (กำลังบันทึก · เพิ่งบันทึก · เลยเวลาหมด) แยกจาก '' ที่แปลว่า "กำลังโหลด".
   *  ก่อนหน้านี้ทางเดียวที่ปุ่มถูกปิดคือ sentinel `''` ⇒ สถานะ `disabled:true` ที่ `dayReminderCta` คืนมา
   *  วาดไม่ได้เลย ปุ่มจะดูกดได้และกดได้จริงทั้งที่ `press` เป็น no-op = กดแล้วเงียบ (อาการของ #340). */
  ctaDisabled?: boolean
  onCta?: () => void
}) {
  const { pathname } = useRouter()

  // state 4 — the save sheet: one full-width button, and deliberately NO Mate AI (Figma).
  //
  // Same '' vs undefined rule as the primary CTA below, and this branch needed it just as much — ตู๋ walked
  // the route rather than guessing: open a day, open the save sheet, then move to a day that has not
  // answered yet. The sheet disappears AND the user is left holding a 361px-wide sapphire button with no
  // label that accepts taps and does nothing. Losing the sheet and gaining a dead control in one beat.
  if (state === 'form') {
    const loading = ctaLabel === ''
    return (
      <nav aria-label="เมนูหลัก" className={NAV}>
        <button
          type="button"
          onClick={onCta}
          disabled={loading || ctaDisabled}
          aria-busy={loading || undefined}
          className="h-[70px] w-full rounded-2xl bg-v3-sapphire text-base font-bold leading-6 text-white disabled:opacity-60"
        >
          {loading ? 'กำลังโหลด…' : (ctaLabel ?? 'บันทึก')}
        </button>
      </nav>
    )
  }

  return (
    <nav aria-label="เมนูหลัก" className={NAV}>
      {/* border/blur below are Figma's Menubar values (461:3303 → 469:3654: border 5px rgba(216,143,169,.4),
          backdrop-blur 6.8px) — the same pair the Mate AI tile carries, so the two halves of the bar can never
          drift apart again. Was border-4 + the default blur. */}
      {state === 'default' ? (
        <ul className="flex h-[70px] min-w-0 flex-1 items-stretch gap-1 rounded-2xl border-[5px] border-[rgba(216,143,169,0.4)] bg-v3-nav-dark bg-clip-padding p-2 backdrop-blur-[6.8px] max-[383px]:gap-0.5 max-[383px]:p-1">
          {TABS.map((tab) => {
            const active = isActive(pathname, tab.href)
            return (
              <li key={tab.href} className="min-w-0 flex-1">
                <Link
                  href={tab.href}
                  aria-current={active ? 'page' : undefined}
                  className={[
                    'flex h-full flex-col items-center justify-center gap-1 whitespace-nowrap rounded-2xl px-1 text-[14px] font-semibold leading-5 transition-colors max-[383px]:px-0 max-[383px]:text-[12px] max-[339px]:text-[11px]',
                    active ? 'bg-v3-sapphire text-v3-lime' : 'text-v3-nav-label-off',
                  ].join(' ')}
                >
                  <span aria-hidden>{tab.icon}</span>
                  <span>{tab.label}</span>
                </Link>
              </li>
            )
          })}
        </ul>
      ) : (
        // states 2/3 — a sapphire CTA filling the left slot. The label shrinks and wraps (up to 2 balanced
        // lines) rather than truncating, so no label is ever cut off mid-word — which in Thai, with no
        // spaces between words, is the difference between "shorter" and "wrong".
        // ⚠️ #326 replaced the state-2 label and #343 added five more, so this can no longer promise that
        // any NAMED phrase survives a given width: the widest label decides, and it changes per state.
        // Which of them actually wrap, and where, is unverified on a real screen — #306 holds that.
        //
        // #343 — the `✓` belongs to the DEFAULT label only, NOT to every label shown in state 'saved'.
        // The menu state is derived from "does this day have a reminder" (menuStateForDay), which is a
        // DIFFERENT question from what the button now says (dayReminderCta, 7 states). Decorating any
        // caller-supplied label made the screen render "✓ เพิ่มยาม" — a checkmark claiming done on a
        // button asking for more. Two sources deciding one string; the caller's own label wins.
        // `??` does not catch '' — and the day-detail loading screen passes exactly that with a no-op
        // handler, so the screen showed a full-width sapphire pill with NO LABEL that ate every tap. Not a
        // "coming soon" case: the action is real and merely not ready for a few hundred ms, so it says so
        // and refuses the press instead of pretending to accept it. (ฟีม 2026-08-06, one of the five.)
        //
        // '' and undefined mean DIFFERENT things and the first version of this conflated them: `!ctaLabel`
        // also caught undefined, which is how /v2/calendar/notifications (state 'saved', no label passed)
        // would have lost "✓ คุณบันทึกลงปฏิทินแล้ว" and shown a disabled "กำลังโหลด…" instead. Explicit ''
        // is the loading signal; absent still means "use the default for this state".
        <button
          type="button"
          data-testid="menubar-cta"
          onClick={onCta}
          disabled={ctaLabel === '' || ctaDisabled}
          aria-busy={ctaLabel === '' || undefined}
          className="flex h-[70px] min-w-0 flex-1 items-center justify-center rounded-2xl bg-v3-sapphire px-4 text-center text-sm font-bold leading-tight text-white [text-wrap:balance] disabled:opacity-60"
        >
          {ctaLabel === ''
            ? 'กำลังโหลด…'
            : (ctaLabel ?? (state === 'saved' ? '✓ คุณบันทึกลงปฏิทินแล้ว' : 'เพิ่มลงปฏิทิน เพื่อแจ้งเตือน'))}
        </button>
      )}
      <MateAIButton />
    </nav>
  )
}

export default Menubar
