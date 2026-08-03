// MuMate v2 — bottom Menubar (app-shell scaffold, Phase 0). Spec: DESIGN.md v3 §Menubar — dark
// #1A1A1A floating pill, pink border, 4 tabs (หน้าหลัก/บริการ/ปฏิทิน/ร้านค้า), Inter SemiBold 14,
// active = sapphire #1455A4 fill + lime #E1FF00 label.
//
// 2026-08-03 (ฟีม "Mate AI ทุกหน้า"): this nav was the ONLY one without the Mate AI button — the five screens
// that use it (service hub · coming-soon · compat form · compat recent · shop) were missing it while home and
// the calendar flow had it. It now renders the SHARED MateAIButton, so both navs show the same button from one
// source. Adding it widens the bar (~244 → ~332), so the tab pill was also made SHRINKABLE (min-w-0 flex-1,
// like CalendarMenu's CTA slot) — otherwise the extra 88px would clip on a 320-wide screen. The whole bar is
// capped at the 393 content width and centred, and carries the safe-area inset it previously lacked.
import Link from 'next/link'
import { useRouter } from 'next/router'
import { MateAIButton } from './MateAIButton'
import type { ReactNode } from 'react'

type Tab = { href: string; label: string; icon: ReactNode }

// Minimal inline 16px icons — kept local so the shell has no icon-lib dependency; swappable for the
// design-system icon set later.
const iconProps = { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }

const TABS: Tab[] = [
  {
    href: '/v2',
    label: 'หน้าหลัก',
    icon: (
      <svg {...iconProps}><path d="M3 9.5 12 3l9 6.5" /><path d="M5 10v10h14V10" /></svg>
    ),
  },
  {
    href: '/v2/service',
    label: 'บริการ',
    icon: (
      <svg {...iconProps}><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>
    ),
  },
  {
    href: '/v2/calendar',
    label: 'ปฏิทิน',
    icon: (
      <svg {...iconProps}><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M3 9h18M8 2v4M16 2v4" /></svg>
    ),
  },
  {
    href: '/v2/shop',
    label: 'ร้านค้า',
    icon: (
      <svg {...iconProps}><path d="M4 4h16l-1.5 5H5.5L4 4Z" /><path d="M5.5 9 6 20h12l.5-11" /></svg>
    ),
  },
]

function isActive(pathname: string, href: string): boolean {
  return href === '/v2' ? pathname === '/v2' : pathname === href || pathname.startsWith(`${href}/`)
}

export function Menubar() {
  const { pathname } = useRouter()
  return (
    <nav
      aria-label="เมนูหลัก"
      className="fixed inset-x-0 bottom-0 z-40 mx-auto flex max-w-md items-center gap-3.5 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2"
    >
      <ul className="flex min-w-0 flex-1 items-stretch gap-1 rounded-2xl border-[5px] border-[rgba(216,143,169,0.4)] bg-[#1A1A1A] p-2 shadow-lg backdrop-blur max-[383px]:gap-0.5 max-[383px]:p-1">
        {TABS.map((tab) => {
          const active = isActive(pathname, tab.href)
          return (
            <li key={tab.href} className="min-w-0 flex-1">
              <Link
                href={tab.href}
                aria-current={active ? 'page' : undefined}
                className={[
                  'flex flex-col items-center gap-1 whitespace-nowrap rounded-xl px-1 py-2 font-poppins-v3 text-[14px] font-semibold leading-5 transition-colors max-[383px]:px-0 max-[383px]:text-[12px] max-[339px]:text-[11px]',
                  active
                    ? 'bg-v3-sapphire text-v3-lime'
                    : 'text-v3-nav-label-off hover:bg-[#0B305B]',
                ].join(' ')}
              >
                <span aria-hidden="true">{tab.icon}</span>
                <span>{tab.label}</span>
              </Link>
            </li>
          )
        })}
      </ul>
      <MateAIButton />
    </nav>
  )
}
