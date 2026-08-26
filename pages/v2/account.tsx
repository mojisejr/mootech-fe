// MuMate v2 — จอ "สิทธิ์ของฉัน" (mootech-fe#365). Behind the v2 gate. Glue only.
//
// Not wrapped in AppShell: AccountScreen renders its own <Menubar/>, and so does AppShell — nesting them
// paints two nav bars. Same reason as pages/v2/shop.tsx.
import type { GetServerSideProps } from 'next'
import { v2RedirectIfUnauthed } from '@/lib/v2/gate'
import { AccountScreen } from '@/features/v2-account/components/AccountScreen'

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  ctx.res.setHeader('Cache-Control', 'no-store, must-revalidate')
  const redirect = v2RedirectIfUnauthed(ctx.req)
  if (redirect) return redirect
  return { props: {} }
}

export default function V2AccountPage() {
  return <AccountScreen />
}
