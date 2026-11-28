// MuMate v2 — /v2/friends/[id] หน้าดูดวงเพื่อน (ประชุม 24 พ.ย. ข้อ 2). Behind the v2 gate. Glue only.
// TWO gates server-side: not authed → /v2 (v2RedirectIfUnauthed) · id รูปแบบไม่ถูก → กลับรายชื่อเพื่อน
import type { GetServerSideProps } from 'next'
import { v2RedirectIfUnauthed } from '@/lib/v2/gate'
import { FriendFortuneScreen } from '@/features/v2-friends/components/FriendFortuneScreen'
import { FRIENDS_LIST_HREF } from '@/features/v2-friends/components/FriendFortuneScreen'

// id ของแถว member_with_friend (uuid หรือ id ที่ระบบเก่าออกให้) — ตัดอักขระแปลก ๆ ก่อนส่งต่อให้ API
const ID_RE = /^[A-Za-z0-9-]{1,64}$/

type Props = { friendId: string }

export const getServerSideProps: GetServerSideProps<Props> = async (ctx) => {
  ctx.res.setHeader('Cache-Control', 'no-store, must-revalidate')
  const redirect = v2RedirectIfUnauthed(ctx.req)
  if (redirect) return redirect
  const raw = Array.isArray(ctx.params?.id) ? ctx.params?.id[0] : ctx.params?.id
  const friendId = typeof raw === 'string' ? raw.trim() : ''
  if (!ID_RE.test(friendId)) {
    return { redirect: { destination: FRIENDS_LIST_HREF, permanent: false } }
  }
  return { props: { friendId } }
}

export default function V2FriendFortunePage({ friendId }: Props) {
  return <FriendFortuneScreen friendId={friendId} />
}
