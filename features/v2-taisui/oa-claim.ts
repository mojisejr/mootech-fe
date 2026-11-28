// ปีชง 2570 — what the page does with the answer of the existing LINE OA reward route (/api/v2/line-oa-claim).
import type { OaClaim } from './components/taisui-motion'

// bazi /api/qi/earn answers { awarded: boolean, capped, earnedQi: number, … }: the amount is earnedQi,
// awarded only says whether it paid (staging showed "+true ชี่" on 2026-11-23).
export function oaClaimFrom(status: number, body: { awarded?: boolean; capped?: boolean; earnedQi?: number; reason?: string } | null): OaClaim {
  if (status >= 200 && status < 300) return body?.capped || body?.awarded === false ? { state: 'already' } : { state: 'paid', qi: typeof body?.earnedQi === 'number' && body.earnedQi > 0 ? body.earnedQi : 100 }
  if (status === 409 && body?.reason === 'not_friend') return { state: 'not_friend' }
  // revision 0.15: logged in with Google (400 not_line) → the page asks them to link LINE first
  if (status === 400 && body?.reason === 'not_line') return { state: 'google' }
  // an expired LINE token (401) or a LINE error: nothing to show
  return { state: 'skip' }
}
