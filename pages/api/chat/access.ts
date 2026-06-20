// Server-resolved access gate for the bazi chat (#mootech-bazi-chat-lane).
// Returns whether the current logged-in user may see the chat, WITHOUT exposing the tester
// allowlist to the client. Identity is read from the auth cookies (cookie-mumate-id uuid +
// cookie-mumate-email); the allowlist (BAZI_CHAT_TESTERS) and public switch (BAZI_CHAT_PUBLIC)
// stay server-side. Lightweight: no DB hit (email comes from the login cookie).
import type { NextApiRequest, NextApiResponse } from "next"
import { parseTesters, resolveChatAccess } from "@/lib/chat/access"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" })
    return
  }
  const rawId = req.cookies["cookie-mumate-id"] ?? ""
  const userId = UUID_RE.test(rawId) ? rawId : ""
  const email = req.cookies["cookie-mumate-email"] ?? ""

  const enabled = resolveChatAccess({
    userId,
    email,
    publicEnabled: process.env.BAZI_CHAT_PUBLIC === "true",
    testers: parseTesters(process.env.BAZI_CHAT_TESTERS),
  })

  // userId returned only when enabled — used by the client to key per-user chat history.
  res.status(200).json({ enabled, userId: enabled ? userId : "" })
}
