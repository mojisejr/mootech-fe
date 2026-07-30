// pages/v2/service/compatibility/result/[matchingId].tsx — ดวงสมพงศ์ Slice 2E-1 result route.
// Reached after the picker's "ดูผลลัพธ์เลย" fires calculateCompatibility (side-effect: log + quota) and
// navigates here with the returned matching_id. The screen reads that id via useCompatibilityResult.
// Same server gate as the picker: not-authed → /v2; missing id → back to the service hub (never blank).
import type { GetServerSideProps } from 'next'
import { v2RedirectIfUnauthed } from '@/lib/v2/gate'
import { CompatibilityResultScreen } from '@/features/v2-service/components/CompatibilityResultScreen'

type Props = { matchingId: string }

export const getServerSideProps: GetServerSideProps<Props> = async (ctx) => {
  ctx.res.setHeader('Cache-Control', 'no-store, must-revalidate')
  const redirect = v2RedirectIfUnauthed(ctx.req)
  if (redirect) return redirect
  const matchingId = String(ctx.params?.matchingId ?? '')
  if (!matchingId) return { redirect: { destination: '/v2/service', permanent: false } }
  return { props: { matchingId } }
}

export default function V2CompatibilityResultPage({ matchingId }: Props) {
  return <CompatibilityResultScreen matchingId={matchingId} />
}
