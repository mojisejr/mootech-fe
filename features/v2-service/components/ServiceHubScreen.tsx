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
import { SERVICES } from '../services'
import { ServiceHeader } from './ServiceHeader'
import { ServiceCard } from './ServiceCard'

export function ServiceHubScreen() {
  // avatar → logout menu (same as home). useV2Logout is goo's action hook; Lamun owns the confirm UI.
  const [logoutOpen, setLogoutOpen] = useState(false)
  const { logout } = useV2Logout()

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
        <ServiceHeader onAvatar={() => setLogoutOpen(true)} />
        <div data-testid="service-hub-list" className="flex flex-col gap-2">
          {SERVICES.map((s) => (
            <ServiceCard key={s.id} data={s} />
          ))}
        </div>
      </div>

      <Menubar />
      {logoutOpen && <LogoutModal onClose={() => setLogoutOpen(false)} onConfirm={logout} />}
    </div>
  )
}
