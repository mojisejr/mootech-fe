// Balance proxy for the chat UI (#mootech-chat-credit-wallet).
// Browser -> this route -> NestJS /ai/balance. Identity is resolved server-side
// from the auth cookie (cookie-mumate-id), so the browser can't read another
// user's wallet. Also surfaces the enforcement flag so the UI can decide copy.
import type { NextApiRequest, NextApiResponse } from "next"
import { fetchBalance, creditEnforced } from "@/lib/credit/wallet-client"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" })
    return
  }

  const rawId = req.cookies["cookie-mumate-id"] ?? ""
  const userId = UUID_RE.test(rawId) ? rawId : ""
  if (!userId) {
    res.status(401).json({ code: "not_authenticated" })
    return
  }

  const bal = await fetchBalance(userId)
  if (!bal) {
    res.status(502).json({ error: "balance unavailable" })
    return
  }

  res.status(200).json({ ...bal, enforced: creditEnforced() })
}
