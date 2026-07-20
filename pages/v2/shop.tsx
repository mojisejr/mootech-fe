// MuMate v2 — ร้านค้า (shop) tab (Phase 0 thin page). Behind the v2 gate (middleware + this SSR
// re-check); mounts the app-shell with a placeholder body. Real shop flow lands in Phase B.
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

export default function V2ShopPage() {
  return (
    <AppShell title="ร้านค้า">
      <PlaceholderScreen heading="ร้านค้า" />
    </AppShell>
  )
}
