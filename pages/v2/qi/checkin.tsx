// MuMate v2 — /v2/qi/checkin จอเช็คอินเต็ม (เฟรม check-in — reward moments/states). Behind the v2 gate. Glue only.
import type { GetServerSideProps } from 'next'
import { v2RedirectIfUnauthed } from '@/lib/v2/gate'
import { QiCheckinScreen } from '@/features/v2-qi/components/QiCheckinScreen'

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  ctx.res.setHeader('Cache-Control', 'no-store, must-revalidate')
  const redirect = v2RedirectIfUnauthed(ctx.req)
  if (redirect) return redirect
  return { props: {} }
}

export default function V2QiCheckinPage() {
  return <QiCheckinScreen />
}
