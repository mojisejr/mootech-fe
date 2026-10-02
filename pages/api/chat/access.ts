// Server-resolved access gate for the bazi chat (#mootech-bazi-chat-lane).
// Returns whether the current logged-in user may see the chat, WITHOUT exposing the tester
// allowlist to the client. The member is the signed session's (resolveOptionalRouteMember, hardening
// slice 1); the email still comes from the cookie-mumate-email login cookie, which only decides whether
// the chat UI shows for a tester. The allowlist (BAZI_CHAT_TESTERS) and public switch (BAZI_CHAT_PUBLIC)
// stay server-side.
import type { NextApiRequest, NextApiResponse } from "next"
import { parseTesters, resolveChatAccess } from "@/lib/chat/access"
import { resolveOptionalRouteMember } from '@/lib/v2/resolve-user'


export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" })
    return
  }
  const userId = await resolveOptionalRouteMember(req, res)
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
