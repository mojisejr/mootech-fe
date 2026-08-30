// pages/v2/service/compatibility/recent.tsx — ดวงสมพงศ์ ก้อน 2G route (D37).
// Same server gate as the picker/result: not-authed → /v2 (never a blank/half screen). The list itself is
// read client-side by useCompatibilityRecent.
//
// 🔴 CORRECTED (#541 ②, ตู๋). This line used to say "v1 UserMatchingGetApi by cookie user_id", and both
// halves stopped being true when #540 moved the lane off mootech-be:
//   the caller   features/v2-service/hooks/useCompatibilityRecent.ts:23 imports V2MatchingGetApi
//                (constants/api/api-v2-matching.ts:20), not UserMatchingGetApi
//   the subject  nothing sends a user_id at all — api-v2-matching.ts:22 posts an empty body, and
//                pages/api/v2/matching/index.ts:34 derives the caller from the signed session, then
//                :59 filters on that id. The cookie's only remaining job is the gate above.
// Held by scripts/compat-readers-v2-lane.test.ts, which walks this reader's whole import closure — a
// comment cannot be tested, but the fact it now describes can be.
import type { GetServerSideProps } from 'next'
import { v2RedirectIfUnauthed } from '@/lib/v2/gate'
import { CompatibilityRecentScreen } from '@/features/v2-service/components/CompatibilityRecentScreen'

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  ctx.res.setHeader('Cache-Control', 'no-store, must-revalidate')
  const redirect = v2RedirectIfUnauthed(ctx.req)
  if (redirect) return redirect
  return { props: {} }
}

export default function V2CompatibilityRecentPage() {
  return <CompatibilityRecentScreen />
}
