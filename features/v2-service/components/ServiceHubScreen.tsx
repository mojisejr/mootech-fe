// features/v2-service/components/ServiceHubScreen.tsx — "บริการทั้งหมด" (Figma node 333:7519).
// 12 catalog cards + shared top-bar + bottom Menubar. No fetch beyond the page-level v2 gate; the only
// state is the logout-confirm the avatar opens (ฟีม: service avatar behaves like home — opens the logout
// menu). Bell + avatar are the SHARED TopBar* components (bell → notifications, avatar → logout).
//
// Layout mirrors home's shell PATTERN (own bg-cream ground + BG01 hero fade + centred max-w column that
// clears the fixed nav) — NOT AppShell, whose bg is ghost-white (== the card colour) which would flatten
// the cards. Cards sit on cream (#FAF7F4, the Figma BG stop) so the ghost-white surfaces read distinctly.
import { useState } from 'react'
import Head from 'next/head'
import Image from 'next/image'
import { Menubar } from '@/features/v2-shell/components/Menubar'
import { LogoutModal } from '@/features/v2-shell/components/LogoutModal'
import { useV2Logout } from '@/features/auth/hooks/useV2Logout'
import { useClientTier } from '@/features/v2-shell/hooks/useClientTier'
import { VISIBLE_SERVICES } from '../services'
import { ServiceHeader } from './ServiceHeader'
import { ServiceCard } from './ServiceCard'

// teamPreview (issue #225): drilled one level from pages/v2/service.tsx's getServerSideProps so the ?tier=
// override can key off the v2 gate on prod. Default false = free behaviour if ever rendered without it.
export function ServiceHubScreen({ teamPreview = false }: { teamPreview?: boolean }) {
  // avatar → logout menu (same as home). useV2Logout is goo's action hook; Lamun owns the confirm UI.
  const [logoutOpen, setLogoutOpen] = useState(false)
  const { logout } = useV2Logout()
  // Zone 4 — this screen shipped with the อัพเกรด pill hardcoded on, because it had no tier to read. It
  // does now. NOTE this one is an inference, flagged as such: Figma has a free/paid pair for the two
  // calendar screens and both say "paid has no pill", but there is no paid frame for บริการทั้งหมด. The
  // rule is applied because showing "อัพเกรด" to someone who already upgraded is a real annoyance, not
  // because a drawing says so — if ฟีม wants it always-on here, it is a one-word change.
  const tier = useClientTier(teamPreview)

  return (
    <div className="relative min-h-screen w-full overflow-x-hidden bg-v3-bg-cream font-ibm">
      <Head>
        <title>บริการทั้งหมด · MuMate</title>
      </Head>

      {/* BG01 hero fading into the cream ground — same continuity pattern as home (no seam). */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[365px] select-none">
        <Image src="/images/v2/bg/BG01.png" alt="" fill priority sizes="100vw" style={{ objectFit: 'cover', objectPosition: 'top center' }} />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-v3-bg-cream/40 to-v3-bg-cream" />
      </div>

      {/* content column: 393 primary, centred + capped, clears the fixed Menubar */}
      <div className="relative z-10 mx-auto flex w-full max-w-md flex-col px-4 pb-36 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <ServiceHeader onAvatar={() => setLogoutOpen(true)} membership={tier} />
        <div data-testid="service-hub-list" className="flex flex-col gap-2">
          {/* VISIBLE_SERVICES, not SERVICES: Healing Circles has no delivered art and is hidden until it
              does (ฟีม 2026-08-05). The catalog row still exists — see services.ts. The first two cards
              are above the fold on every phone, so their art loads eagerly and the other nine defer. */}
          {VISIBLE_SERVICES.map((s, i) => (
            <ServiceCard key={s.id} data={s} eagerArt={i < 2} />
          ))}
        </div>
      </div>

      <Menubar />
      {logoutOpen && <LogoutModal onClose={() => setLogoutOpen(false)} onConfirm={logout} />}
    </div>
  )
}
