// MuMate v2 — app-shell (Phase 0 scaffold). The persistent chrome every /v2 page renders inside:
// a scrollable content column + the fixed bottom Menubar. Feature pages just drop their body in as
// `children`; they never re-declare the nav. Deliberately thin — real per-screen backgrounds
// (BG0-4), the Mate AI FAB, and top-bar chrome land with Lamun's universal-components PR.
import type { ReactNode } from 'react'
import Head from 'next/head'
import { Menubar } from './Menubar'

type AppShellProps = {
  title?: string
  children: ReactNode
}

export function AppShell({ title, children }: AppShellProps) {
  return (
    <>
      <Head>
        <title>{title ? `${title} · MuMate` : 'MuMate'}</title>
      </Head>
      <div className="min-h-screen bg-v3-ghost-white">
        {/* pb clears the fixed Menubar (pill ~70px + bottom-4 offset) */}
        <main className="mx-auto w-full max-w-md px-4 pb-28 pt-6">{children}</main>
        <Menubar />
      </div>
    </>
  )
}
