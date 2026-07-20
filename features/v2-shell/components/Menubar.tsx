// MuMate v2 — bottom Menubar (app-shell scaffold, Phase 0). Spec: DESIGN.md v3 §Menubar — dark
// #1A1A1A floating pill, pink border, 4 tabs (หน้าหลัก/บริการ/ปฏิทิน/ร้านค้า), Inter SemiBold 14,
// active = sapphire #1455A4 fill + lime #E1FF00 label. This is the SHELL only (nav + active state);
// exact-token polish / the Mate AI FAB come with Lamun's universal-components PR.
import Link from 'next/link'
import { useRouter } from 'next/router'
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
      className="fixed bottom-4 left-1/2 z-40 -translate-x-1/2 rounded-2xl border-[5px] border-[rgba(216,143,169,0.4)] bg-[#1A1A1A] p-2 shadow-lg backdrop-blur"
    >
      <ul className="flex items-stretch gap-1">
        {TABS.map((tab) => {
          const active = isActive(pathname, tab.href)
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={active ? 'page' : undefined}
                className={[
                  'flex w-[58px] flex-col items-center gap-1 rounded-xl py-2 font-poppins-v3 text-[14px] font-semibold leading-5 transition-colors',
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
    </nav>
  )
}
