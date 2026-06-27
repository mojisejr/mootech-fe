// Server-side client for the NestJS AI credit wallet (#mootech-chat-credit-wallet).
// Used by the bazi BFF gate and the /api/chat/balance proxy. Never import in the
// browser — it carries the BFF↔BE shared secret.
//
// ENDPOINT mirrors constants/api/endpoint.ts (our own NestJS-on-Supabase only).
const ENDPOINT = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000"

export type WalletBalance = {
  isMember: boolean
  unlimited: boolean
  balance: number
}

/** Enforcement flag — mirror of BE `CREDIT_ENFORCE`. Default ON (testers get
 * real behavior). `off` = counter-only: track/display but never block. Keep this
 * value identical on Render (BE) and Vercel (FE). */
export const creditEnforced = (): boolean =>
  (process.env.CREDIT_ENFORCE ?? "on").toLowerCase() !== "off"

/** Read the AI_GENERAL wallet for a user. Returns null on any transport failure
 * so callers can decide fail-open vs fail-closed explicitly. */
export async function fetchBalance(
  userId: string,
): Promise<WalletBalance | null> {
  try {
    const r = await fetch(`${ENDPOINT}/ai/balance/${userId}`)
    if (!r.ok) return null
    return (await r.json()) as WalletBalance
  } catch {
    return null
  }
}

/** Spend one credit (best-effort). A missed consume must never break the user's
 * answer, so transport errors are swallowed. */
export async function consumeCredit(userId: string): Promise<void> {
  const secret = process.env.AI_CONSUME_SECRET || ""
  try {
    await fetch(`${ENDPOINT}/ai/consume`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-ai-secret": secret,
      },
      body: JSON.stringify({ user_id: userId }),
    })
  } catch {
    // best-effort; swallow
  }
}
