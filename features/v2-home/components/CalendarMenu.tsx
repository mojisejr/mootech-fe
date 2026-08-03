import Link from 'next/link'
import { useRouter } from 'next/router'
import { MateAIButton } from '@/features/v2-shell/components/MateAIButton'

// Shared bottom menu (Figma menu `461:3224`) — extracted from HomeBottomNav so home + the calendar flow use ONE
// component with multiple STATES. PRESENTATIONAL: it renders the state it is TOLD to; goo owns which screen shows
// which state (enum v0 = bong-infer + feem-count, NOT-YET Figma-enumerated per-screen — verified as those screens
// are built). The left slot swaps; the Mate AI slot never changes — except state 'form', which drops it.
//
//   default    (1) 4 tabs (หน้าหลัก·บริการ·ปฏิทิน·ร้านค้า) + Mate AI    — calendar month, home
//   primary-cta(2) blue primary button + Mate AI                        — day detail (unsaved), both modes
//   saved      (3) blue "✓ …" button + Mate AI                          — day detail after save
//   form       (4) full-width button, NO Mate AI                        — save sheet
//
// NOTE (Figma-fidelity gap, kept out of scope to honor done-condition-5 "home unchanged"): Figma's tabs carry an
// icon above each label; the shipped home nav is text-only. Adding icons would change home beyond the A1 mascot fix
// (not in the A1/A2/A3 freeze) → left text-only here; flagged for a future menu-completion decision by ฟีม.
export type CalendarMenuState = 'default' | 'primary-cta' | 'saved' | 'form'

const TABS = [
  { href: '/v2', label: 'หน้าหลัก' },
  { href: '/v2/service', label: 'บริการ' },
  { href: '/v2/calendar', label: 'ปฏิทิน' },
  { href: '/v2/shop', label: 'ร้านค้า' },
]

const NAV = 'fixed inset-x-0 bottom-0 z-30 flex justify-center px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2'

export function CalendarMenu({ state = 'default', ctaLabel, onCta }: {
  state?: CalendarMenuState
  ctaLabel?: string
  onCta?: () => void
}) {
  const { pathname } = useRouter()

  // state 4 (form): one full-width button, no Mate AI.
  if (state === 'form') {
    return (
      <nav className={NAV}>
        <button type="button" onClick={onCta} className="h-[70px] w-full rounded-2xl bg-v3-sapphire text-base font-bold leading-6 text-white">
          {ctaLabel ?? 'บันทึก'}
        </button>
      </nav>
    )
  }

  // states 1/2/3: left slot + the (unchanging) Mate AI slot.
  return (
    <nav className={`${NAV} gap-3.5`}>
      {state === 'default' ? (
        <div className="flex h-[70px] min-w-0 flex-1 items-center justify-center gap-1 rounded-2xl border-4 border-[rgba(216,143,169,0.4)] bg-v3-nav-dark p-2 backdrop-blur max-[383px]:gap-0.5 max-[383px]:p-1">
          {TABS.map((t) => {
            const active = t.href === '/v2' ? pathname === '/v2' : pathname.startsWith(t.href)
            return (
              <Link key={t.href} href={t.href} className={`grid min-w-0 flex-1 place-items-center whitespace-nowrap rounded-2xl px-1 py-2 text-sm font-semibold leading-5 max-[383px]:px-0 max-[383px]:text-[12px] max-[339px]:text-[11px] ${active ? 'bg-v3-sapphire text-v3-lime' : 'text-v3-nav-label-off'}`}>
                {t.label}
              </Link>
            )
          })}
        </div>
      ) : (
        // states 2 (primary-cta) + 3 (saved): a sapphire button filling the left slot. A2 (ฟีม ก): the text
        // NEVER truncates — it shrinks + wraps (leading-tight, up to 2 lines, balanced) so "เพื่อแจ้งเตือน" stays
        // whole even at 320. text-wrap:balance keeps a tidy 2-line break instead of a lone trailing word.
        <button
          type="button"
          onClick={onCta}
          className="flex h-[70px] min-w-0 flex-1 items-center justify-center rounded-2xl bg-v3-sapphire px-4 text-center text-sm font-bold leading-tight text-white [text-wrap:balance]"
        >
          {state === 'saved' ? `✓ ${ctaLabel ?? 'คุณบันทึกลงปฏิทินแล้ว'}` : (ctaLabel ?? 'เพิ่มลงปฏิทิน เพื่อแจ้งเตือน')}
        </button>
      )}
      <MateAIButton />
    </nav>
  )
}
