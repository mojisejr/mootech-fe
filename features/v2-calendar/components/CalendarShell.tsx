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
  onCta,
  children,
}: {
  title?: string
  menuState: CalendarMenuState
  ctaLabel?: string
  onCta?: () => void
  children: ReactNode
}) {
  return (
    <>
      <Head>
        <title>{title ? `${title} · MuMate` : 'MuMate'}</title>
      </Head>
      <div className="min-h-screen bg-v3-ghost-white">
        <main className="mx-auto w-full max-w-md pb-32 pt-0">{children}</main>
        <CalendarMenu state={VARIANT[menuState]} ctaLabel={ctaLabel} onCta={onCta} />
      </div>
    </>
  )
}
