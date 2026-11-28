// MuMate v2 — /v2/friends หน้ารายชื่อเพื่อน (ประชุม 24 พ.ย. ข้อ 3). Behind the v2 gate. Glue only.
import type { GetServerSideProps } from 'next'
import { v2RedirectIfUnauthed } from '@/lib/v2/gate'
import { FriendsListScreen } from '@/features/v2-friends/components/FriendsListScreen'

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  ctx.res.setHeader('Cache-Control', 'no-store, must-revalidate')
  const redirect = v2RedirectIfUnauthed(ctx.req)
  if (redirect) return redirect
  return { props: {} }
}

export default function V2FriendsPage() {
  return <FriendsListScreen />
}
