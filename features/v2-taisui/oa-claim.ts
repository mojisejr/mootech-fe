// ปีชง 2570 — what the page does with the answer of the existing LINE OA reward route (/api/v2/line-oa-claim).
import type { OaClaim } from './components/taisui-motion'

export function oaClaimFrom(status: number, body: { awarded?: number; capped?: boolean; reason?: string } | null): OaClaim {
  if (status >= 200 && status < 300) return body?.capped ? { state: 'already' } : { state: 'paid', qi: body?.awarded ?? 100 }
  // Logged in with Google (400 not_line), an expired LINE token (401) or a LINE error: nothing to show.
  return status === 409 && body?.reason === 'not_friend' ? { state: 'not_friend' } : { state: 'skip' }
}
