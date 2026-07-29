// MuMate v2 — บริการ (service) tab. The service HUB: a catalog of 12 services (Figma 333:7519).
// Behind the v2 gate (middleware + this SSR re-check). Presentational only — no fetch, no state, no auth
// beyond the gate; the hub screen owns its own shell (bg + Menubar), so no AppShell wrapper here.
import type { GetServerSideProps } from 'next'
import { v2RedirectIfUnauthed } from '@/lib/v2/gate'
import { ServiceHubScreen } from '@/features/v2-service/components/ServiceHubScreen'

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  ctx.res.setHeader('Cache-Control', 'no-store, must-revalidate')
  const redirect = v2RedirectIfUnauthed(ctx.req)
  if (redirect) return redirect
  return { props: {} }
}

export default function V2ServicePage() {
  return <ServiceHubScreen />
}
