import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/router'

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

// The Mate AI button — SHARED by states 1/2/3. A1 fix (ฟีม ก · อยู่ในปุ่ม): the mascot (Figma 75×92 at y=9 in a
// 70-tall Navbar) is CLIPPED to the button so its head sits inside and the bottom 31px is cut — matching Figma.
// The clip lives on a wrapper AROUND THE MASCOT ONLY (not the button) so the "Mate AI" label tab still pokes above
// (the button keeps overflow-visible). Button height stays 70 → nav total ≈ 94px → the home nav-clearance (74px)
// is untouched (ตู๋'s constraint).
function MateAIButton() {
  return (
    <Link href="/v2/service" aria-label="Mate AI" className="relative flex h-[70px] w-[74px] shrink-0 items-center justify-center overflow-visible rounded-2xl border-4 border-[rgba(216,143,169,0.4)] bg-gradient-to-r from-v3-mate-teal to-v3-mate-purple backdrop-blur">
      {/* label sits ON TOP of the mascot head (z-2, matching Figma) and stays 1-line (whitespace-nowrap) — the
          Figma label frame is 102px wide, poking beyond the 74px button, which overflow-visible allows. Without
          nowrap, left-1/2 constrains the shrink-to-fit width to ~37px and "Mate AI" wraps to 2 lines (a latent bug
          that was hidden behind the previously-overflowing mascot; clipping the mascot exposed it). */}
      <span className="absolute -top-1 left-1/2 z-[2] -translate-x-1/2 whitespace-nowrap rounded-t-[18px] bg-v3-lime px-4 text-sm font-black leading-5 text-v3-sapphire">Mate AI</span>
      {/* clip container = the button's own rounded bounds; the mascot is head-aligned (top-[9px]) so the bottom 31px clips */}
      <span className="pointer-events-none absolute inset-0 z-[1] overflow-hidden rounded-[10px]">
        <span className="absolute left-1/2 top-[9px] h-[92px] w-[75px] -translate-x-1/2">
          <Image src="/images/v2/mascot/01-nav.png" alt="" fill sizes="75px" style={{ objectFit: 'contain', objectPosition: 'top' }} />
        </span>
      </span>
    </Link>
  )
}

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
        <div className="flex h-[70px] items-center justify-center gap-2 rounded-2xl border-4 border-[rgba(216,143,169,0.4)] bg-v3-nav-dark p-2 backdrop-blur">
          {TABS.map((t) => {
            const active = t.href === '/v2' ? pathname === '/v2' : pathname.startsWith(t.href)
            return (
              <Link key={t.href} href={t.href} className={`grid w-[58px] place-items-center rounded-2xl py-2 text-sm font-semibold leading-5 ${active ? 'bg-v3-sapphire text-v3-lime' : 'text-v3-nav-label-off'}`}>
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
