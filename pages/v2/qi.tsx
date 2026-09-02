// MuMate v2 — จอ "พลังชี่ของฉัน" (/v2/qi). Behind the v2 gate. Glue only.
// Design: Figma "Mumate app_ final" frame qi-token-guide-v2-brand-ci + wallet จากคลิปทีม.
// No Menubar: docked composer-free simple scroll (same reasoning as /v2/shop).
import type { GetServerSideProps } from 'next'
import { v2RedirectIfUnauthed } from '@/lib/v2/gate'
import { QiScreen } from '@/features/v2-qi/components/QiScreen'

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  ctx.res.setHeader('Cache-Control', 'no-store, must-revalidate')
  const redirect = v2RedirectIfUnauthed(ctx.req)
  if (redirect) return redirect
  return { props: {} }
}

export default function V2QiPage() {
  return <QiScreen />
}
