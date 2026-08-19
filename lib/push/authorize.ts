// MuMate v2 · cron caller check (goo · #288 phase 4). Pure + db-free so it is unit-provable without
// booting the DB module. FAILS CLOSED: no CRON_SECRET configured → deny every request, so a freshly
// deployed (public) endpoint is never open before ฟีม sets the secret on Vercel.
//
// Vercel attaches `Authorization: Bearer <CRON_SECRET>` automatically when CRON_SECRET is set
// (Vercel docs 2026-07-15). We compare against that — never the spoofable user-agent / cron headers.

export function isAuthorized(authHeader: string | undefined, secret: string | undefined): boolean {
  if (!secret) return false
  return authHeader === `Bearer ${secret}`
}
