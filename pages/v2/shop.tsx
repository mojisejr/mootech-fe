// MuMate v2 — ร้านค้า (shop) tab. Behind the v2 gate (middleware + this SSR re-check).
//
// B2: the body is the shared "เร็วๆ นี้" screen, rendered HERE rather than redirected to
// /v2/service/coming-soon — Menubar.isActive keys off the pathname, so a redirect would leave the user
// who tapped ร้านค้า looking at a highlighted บริการ tab. Same reason the back link points home instead
// of at the service hub: from this tab, "กลับไปหน้าบริการ" is a tab-jump, not a way back.
//
// Not wrapped in AppShell: AppShell renders its own <Menubar/>, and so does this screen — nesting them
// paints two nav bars.
import type { GetServerSideProps } from 'next'
import { v2RedirectIfUnauthed } from '@/lib/v2/gate'
import { ServiceComingSoonScreen } from '@/features/v2-service/components/ServiceComingSoonScreen'

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  ctx.res.setHeader('Cache-Control', 'no-store, must-revalidate')
  const redirect = v2RedirectIfUnauthed(ctx.req)
  if (redirect) return redirect
  return { props: {} }
}

export default function V2ShopPage() {
  return <ServiceComingSoonScreen serviceName="ร้านค้าของเรา" back={{ href: '/v2', label: 'กลับไปหน้าหลัก' }} />
}
