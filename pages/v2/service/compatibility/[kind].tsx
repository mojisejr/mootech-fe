// pages/v2/service/compatibility/[kind].tsx — ดวงสมพงศ์ Slice 1 entry (goo: route + gate).
// TWO gates in getServerSideProps, both server-side, both fail to a defined destination (NEVER silent):
//   1. v2 preview gate  — not authed → /v2  (same v2RedirectIfUnauthed as every other /v2 page)
//   2. kind gate        — kind ∉ {love, colleague} → /v2/service  (done-cond #1/#2: unknown kind must land
//      back on the hub, not render a blank/half screen). resolveCompatibilityKind is the single source of
//      truth (shared with the hook), so the redirect decision and the on-screen title can't drift.
// The validated { kind, title, matchingType } is handed to the screen as props; the client hook re-derives
// the same config from `kind` for its state. matching_type is carried but NOT fired here (result slice).
import type { GetServerSideProps } from 'next'
import { v2RedirectIfUnauthed } from '@/lib/v2/gate'
import { resolveCompatibilityKind, type CompatibilityConfig } from '@/features/v2-service/compatibility'
import { CompatibilityScreen } from '@/features/v2-service/components/CompatibilityScreen'

type Props = { config: CompatibilityConfig }

export const getServerSideProps: GetServerSideProps<Props> = async (ctx) => {
  ctx.res.setHeader('Cache-Control', 'no-store, must-revalidate')

  const redirect = v2RedirectIfUnauthed(ctx.req)
  if (redirect) return redirect

  const config = resolveCompatibilityKind(ctx.params?.kind)
  if (!config) {
    // unknown kind → back to the service hub, explicitly (done-cond: ห้ามเงียบ)
    return { redirect: { destination: '/v2/service', permanent: false } }
  }

  return { props: { config } }
}

export default function V2CompatibilityPage({ config }: Props) {
  return <CompatibilityScreen config={config} />
}
