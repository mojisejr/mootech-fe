// pages/v2/service/compatibility/work/[id].tsx — #585 ก้อน 5, the colleague lane's result route.
//
// 🔴 THE PATH IS NOT CHOSEN HERE. `recentHrefFor` (features/v2-service/compatibility-recent.ts:74-79)
// already sends every `lane: 'work'` card to `/v2/service/compatibility/work/<id>`, and it has a test
// holding that. This file exists to BE that destination. If the route ever moves, it moves in
// recentHrefFor first and this file follows — two places deciding one URL is how a card 404s while both
// halves look correct on their own.
//
// The param is `id` to match the API route it reads (pages/api/v2/matching/work/[id].ts). The love lane
// next door uses `[matchingId]`; the names are independent because only the path SEGMENT is shared.
//
// Same server gate as every other v2 service page: not authed → /v2, missing id → the hub, never a blank
// screen and never a client-side redirect the user can watch happen.
import type { GetServerSideProps } from 'next'
import { v2RedirectIfUnauthed } from '@/lib/v2/gate'
import { WorkResultScreen } from '@/features/v2-service/components/WorkResultScreen'

type Props = { id: string }

export const getServerSideProps: GetServerSideProps<Props> = async (ctx) => {
  ctx.res.setHeader('Cache-Control', 'no-store, must-revalidate')
  const redirect = v2RedirectIfUnauthed(ctx.req)
  if (redirect) return redirect
  const id = String(ctx.params?.id ?? '')
  if (!id) return { redirect: { destination: '/v2/service', permanent: false } }
  return { props: { id } }
}

export default function V2CompatibilityWorkResultPage({ id }: Props) {
  return <WorkResultScreen matchingId={id} />
}
