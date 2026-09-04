// MuMate v2 — จอ "ดวงของฉัน" (/v2/destiny). Behind the v2 gate. Glue only.
// Design: Figma "Mumate app_ final" page "ดวงฉัน" frame node 55349-3070 — spec ใน docs/duang-chan-spec.md.
// No Menubar: the share pill + Mate AI dock under the fixed hero card (same reasoning as /v2/shop).
import type { GetServerSideProps } from 'next'
import { v2RedirectIfUnauthed } from '@/lib/v2/gate'
import { DestinyScreen } from '@/features/v2-destiny/components/DestinyScreen'

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  ctx.res.setHeader('Cache-Control', 'no-store, must-revalidate')
  const redirect = v2RedirectIfUnauthed(ctx.req)
  if (redirect) return redirect
  return { props: {} }
}

export default function V2DestinyPage() {
  return <DestinyScreen />
}
