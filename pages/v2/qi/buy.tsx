// MuMate v2 — /v2/qi/buy หน้าเติมชี่ (เฟรม buy-qi — select pack, ก้อน 1.6). Behind the v2 gate. Glue only.
import type { GetServerSideProps } from 'next'
import { v2RedirectIfUnauthed } from '@/lib/v2/gate'
import { QiBuyScreen } from '@/features/v2-qi/components/QiBuyScreen'

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  ctx.res.setHeader('Cache-Control', 'no-store, must-revalidate')
  const redirect = v2RedirectIfUnauthed(ctx.req)
  if (redirect) return redirect
  return { props: {} }
}

export default function V2QiBuyPage() {
  return <QiBuyScreen />
}
