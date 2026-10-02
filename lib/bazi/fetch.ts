// lib/bazi/fetch.ts — the one way the FE server calls the bazi engine
// (mumate-member-identity-hardening-001 slice 1 step 3, 2026-10-02).
//
// bazi's member routes take the member from an `anonId` in the request. They answer only a caller that
// sends `x-mumate-client-secret` = BAZI_CLIENT_ID_SECRET, which only this server holds. baziFetch adds it
// to every call; scripts/bazi-fetch-secret.test.ts keeps every file that talks to bazi on baziFetch.
//
// No secret set = the init passes through untouched (the pre-hardening behaviour). server only — the secret
// must never get a NEXT_PUBLIC_ name. lib/bazi/client-identity.ts still adds the member's IP for rate limits.

const HEADER = 'x-mumate-client-secret'

export function withBaziSecret(init: RequestInit | undefined, env: Partial<NodeJS.ProcessEnv> = process.env): RequestInit {
  const secret = env.BAZI_CLIENT_ID_SECRET?.trim()
  if (!secret) return init ?? {}
  const given = init?.headers
  if (given === undefined || (typeof given === 'object' && !(given instanceof Headers) && !Array.isArray(given))) {
    return { ...init, headers: { ...(given as Record<string, string> | undefined), [HEADER]: secret } }
  }
  const headers = new Headers(given)
  headers.set(HEADER, secret)
  return { ...init, headers }
}

export function baziFetch(input: string | URL, init?: RequestInit): Promise<Response> {
  return fetch(input, withBaziSecret(init))
}
