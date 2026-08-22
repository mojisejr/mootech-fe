// MuMate v2 — ร้านค้า (shop) tab. Behind the v2 gate (middleware + this SSR re-check).
//
// Was the shared "เร็วๆ นี้" screen until #359; it is now the real "เลือกแพ็คเกจที่ใช่" screen.
//
// Not wrapped in AppShell: AppShell renders its own <Menubar/>, and so does this screen — nesting them
// paints two nav bars. Same reason as the coming-soon version this replaced.
import type { GetServerSideProps } from 'next'
import { v2RedirectIfUnauthed, isV2TeamPreview } from '@/lib/v2/gate'
import { ShopScreen } from '@/features/v2-shop/components/ShopScreen'

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  ctx.res.setHeader('Cache-Control', 'no-store, must-revalidate')
  const redirect = v2RedirectIfUnauthed(ctx.req)
  if (redirect) return redirect
  // #384 — same thread as pages/v2/calendar.tsx:25. The `?tier=` preview override is gated on this
  // server-verified flag, so without it the team (and the capture pass) cannot view this screen as a member.
  return { props: { teamPreview: isV2TeamPreview(ctx.req) } }
}

export default function V2ShopPage({ teamPreview }: { teamPreview: boolean }) {
  return <ShopScreen teamPreview={teamPreview} />
}
