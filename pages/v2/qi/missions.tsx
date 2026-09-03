// MuMate v2 — /v2/qi/missions บอร์ดภารกิจ (ก้อน 1.2). Behind the v2 gate. Glue only.
import type { GetServerSideProps } from 'next'
import { v2RedirectIfUnauthed } from '@/lib/v2/gate'
import { MissionsScreen } from '@/features/v2-qi/components/MissionsScreen'

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  ctx.res.setHeader('Cache-Control', 'no-store, must-revalidate')
  const redirect = v2RedirectIfUnauthed(ctx.req)
  if (redirect) return redirect
  return { props: {} }
}

export default function V2MissionsPage() {
  return <MissionsScreen />
}
