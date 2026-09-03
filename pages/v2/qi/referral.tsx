// MuMate v2 — /v2/qi/referral หน้าชวนเพื่อนเต็ม (ก้อน 5.1). Behind the v2 gate. Glue only.
import type { GetServerSideProps } from 'next'
import { v2RedirectIfUnauthed } from '@/lib/v2/gate'
import { ReferralHubScreen } from '@/features/v2-qi/components/ReferralHubScreen'

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  ctx.res.setHeader('Cache-Control', 'no-store, must-revalidate')
  const redirect = v2RedirectIfUnauthed(ctx.req)
  if (redirect) return redirect
  return { props: {} }
}

export default function V2ReferralPage() {
  return <ReferralHubScreen />
}
