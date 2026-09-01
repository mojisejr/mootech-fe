// Calendar-flow app chrome (Lamun-owned). The month view + the day-detail view both render inside THIS
// instead of AppShell, so their bottom bar is the shared CalendarMenu (Figma: Mate AI menu), consistent
// across both pages — not AppShell's 4-tab Menubar on one and CalendarMenu on the other. It does NOT touch
// AppShell.tsx / Menubar.tsx, so /v2/service and /v2/shop (which use AppShell) are unaffected.
//
// It maps goo's numeric CalendarMenuState enum → CalendarMenu's presentational string state, one place.
import Head from 'next/head'
import type { ReactNode } from 'react'
import { CalendarMenu, type CalendarMenuState as CalendarMenuVariant } from '@/features/v2-home/components/CalendarMenu'
import { CalendarMenuState } from '../menu-state'

const VARIANT: Record<CalendarMenuState, CalendarMenuVariant> = {
  [CalendarMenuState.Normal]: 'default',
  [CalendarMenuState.PrimaryAction]: 'primary-cta',
  [CalendarMenuState.Saved]: 'saved',
  [CalendarMenuState.FormMode]: 'form',
}

export function CalendarShell({
  title,
  menuState,
  ctaLabel,
  ctaDisabled,
  onCta,
  children,
}: {
  title?: string
  menuState: CalendarMenuState
  ctaLabel?: string
  /** #343 — ปุ่มกดไม่ได้ด้วยเหตุของหน้าเพจ (แยกจาก ctaLabel==='' ที่แปลว่ากำลังโหลด) */
  ctaDisabled?: boolean
  onCta?: () => void
  children: ReactNode
}) {
  return (
    <>
      <Head>
        <title>{title ? `${title} · MuMate` : 'MuMate'}</title>
      </Head>
      {/* The IBM family is applied on the shell, not on each card. IBM Plex Sans Thai is loaded already
          (styles/globals.css:5, all 7 weights) and the family exists (tailwind.config.ts:21), but the
          calendar lane never asked for it, so most of it fell through to the browser default — which on
          Thai is a LOOPED face, the thing ฟีม saw (issue #564).

          The lane was MIXED, not uniformly unstyled: AppHeader and the promo card carry their own
          font class and already rendered in IBM, while the bottom menu, the loading line and every
          day-detail card did not. Measured, not assumed — a 4-line Thai string lays out at 224.55px
          in IBM and 227.45px on the default chain, a 2.9px gap that separates the two cleanly.

          One place, so a card added later inherits it instead of having to remember. */}
      <div className="min-h-screen bg-v3-ghost-white font-ibm">
        <main className="mx-auto w-full max-w-md pb-32 pt-0">{children}</main>
        <CalendarMenu state={VARIANT[menuState]} ctaLabel={ctaLabel} ctaDisabled={ctaDisabled} onCta={onCta} />
      </div>
    </>
  )
}
