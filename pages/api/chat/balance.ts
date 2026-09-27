// GONE — CIEL mumate-be-retirement-001 slice 2b (plan rev 0.4).
//
// This was the balance proxy for the v1 chat UI (#mootech-chat-credit-wallet): browser -> here -> mootech-be
// GET /ai/balance/:userId, through lib/credit/wallet-client.ts. Its only two callers were v1 screens —
// components/bazi-chat-modal.tsx (reached from v1 /chinese-calendar) and pages/profile/index.tsx — and both
// are unreachable since slice 2a redirects every v1 route to v2 (lib/v1-retired-routes.ts). No v2 screen
// calls it: v2 chat reads its allowance from /api/chat/quota (features/v2-chat/components/ChatScreen.tsx).
//
// It answers 410 rather than disappearing (404) so that a stale client, or a person reading a log, is told
// the route was retired on purpose rather than never existing. It no longer reaches mootech-be, and
// wallet-client.ts (with AI_CONSUME_SECRET and CREDIT_ENFORCE, which only it read) is removed.
import type { NextApiRequest, NextApiResponse } from "next"

export default function handler(_req: NextApiRequest, res: NextApiResponse) {
  res.setHeader("Cache-Control", "no-store")
  res.status(410).json({ error: "gone", detail: "the v1 chat balance was retired with mootech-be" })
}
