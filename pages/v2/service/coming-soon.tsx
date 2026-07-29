// MuMate v2 — the shared "เร็วๆ นี้" page for the 10 not-yet-built services (reached from the service
// hub). Same v2 gate as the hub. Presentational only — the service name comes from the ?service= query
// (client-side, via the screen), so no server data is needed.
import type { GetServerSideProps } from 'next'
import { v2RedirectIfUnauthed } from '@/lib/v2/gate'
import { ServiceComingSoonScreen } from '@/features/v2-service/components/ServiceComingSoonScreen'

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  ctx.res.setHeader('Cache-Control', 'no-store, must-revalidate')
  const redirect = v2RedirectIfUnauthed(ctx.req)
  if (redirect) return redirect
  return { props: {} }
}

export default function V2ServiceComingSoonPage() {
  return <ServiceComingSoonScreen />
}
