// Pure allowlist logic for the bazi chat access gate (#mootech-bazi-chat-lane).
//
// Why a server-resolved gate (not a NEXT_PUBLIC_ boolean): NEXT_PUBLIC_* flags are baked at
// build time and visible to every client — they can only turn chat on/off for EVERYONE. To
// ship chat to production fully wired but HIDDEN from the public while a tester can use it on
// real prod, we resolve access server-side from the logged-in identity.
//
// BAZI_CHAT_PUBLIC === "true"  -> chat open to all logged-in users.
// BAZI_CHAT_TESTERS            -> CSV of user_ids OR emails (env vars are strings, never arrays).
//
// Identity itself is resolved upstream from the auth cookie (cookie-mumate-id / -email); this
// module only decides enabled/not from already-resolved values. DB-free, unit-tested.

export function parseTesters(csv: string | undefined | null): string[] {
  return (csv ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
}

export interface ChatAccessInput {
  userId: string | null | undefined
  email?: string | null
  publicEnabled: boolean
  testers: string[]
}

// A logged-in identity is required in all cases (chat is never shown to anonymous visitors).
// When public is open, any logged-in user passes. Otherwise the user_id OR email must be on
// the allowlist (case-insensitive).
export function resolveChatAccess(input: ChatAccessInput): boolean {
  const { userId, email, publicEnabled, testers } = input
  const uid = (userId ?? "").trim().toLowerCase()
  if (!uid) return false
  if (publicEnabled) return true
  if (testers.includes(uid)) return true
  const mail = (email ?? "").trim().toLowerCase()
  if (mail && testers.includes(mail)) return true
  return false
}
