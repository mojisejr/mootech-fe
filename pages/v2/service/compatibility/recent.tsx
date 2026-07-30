// pages/v2/service/compatibility/recent.tsx — ดวงสมพงศ์ ก้อน 2G route (D37).
// Same server gate as the picker/result: not-authed → /v2 (never a blank/half screen). The list itself is
// read client-side by useCompatibilityRecent (v1 UserMatchingGetApi by cookie user_id).
import type { GetServerSideProps } from 'next'
import { v2RedirectIfUnauthed } from '@/lib/v2/gate'
import { CompatibilityRecentScreen } from '@/features/v2-service/components/CompatibilityRecentScreen'

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  ctx.res.setHeader('Cache-Control', 'no-store, must-revalidate')
  const redirect = v2RedirectIfUnauthed(ctx.req)
  if (redirect) return redirect
  return { props: {} }
}

export default function V2CompatibilityRecentPage() {
  return <CompatibilityRecentScreen />
}
