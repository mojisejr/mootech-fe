// MuMate v2 — บริการ (service) tab (Phase 0 thin page). Behind the v2 gate (middleware + this SSR
// re-check); mounts the app-shell with a placeholder body. Real service flow lands in Phase B.
import type { GetServerSideProps } from 'next'
import { v2RedirectIfUnauthed } from '@/lib/v2/gate'
import { AppShell } from '@/features/v2-shell/components/AppShell'
import { PlaceholderScreen } from '@/features/v2-shell/components/PlaceholderScreen'

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  ctx.res.setHeader('Cache-Control', 'no-store, must-revalidate')
  const redirect = v2RedirectIfUnauthed(ctx.req)
  if (redirect) return redirect
  return { props: {} }
}

export default function V2ServicePage() {
  return (
    <AppShell title="บริการ">
      <PlaceholderScreen heading="บริการ" />
    </AppShell>
  )
}
