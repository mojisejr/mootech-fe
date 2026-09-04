// MuMate v2 — /v2/qi/history ประวัติชี่เต็ม (ก้อน 1.3). Behind the v2 gate. Glue only.
import type { GetServerSideProps } from 'next'
import { v2RedirectIfUnauthed } from '@/lib/v2/gate'
import { QiHistoryScreen } from '@/features/v2-qi/components/QiHistoryScreen'

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  ctx.res.setHeader('Cache-Control', 'no-store, must-revalidate')
  const redirect = v2RedirectIfUnauthed(ctx.req)
  if (redirect) return redirect
  return { props: {} }
}

export default function V2QiHistoryPage() {
  return <QiHistoryScreen />
}
