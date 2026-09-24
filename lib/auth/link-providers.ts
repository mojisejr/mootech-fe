// lib/auth/link-providers.ts — provider knowledge for the linking flow
// (mumate-login-identity-001 slice 3). Pure functions, no request object, so the
// authorize URL and every refusal can be proven without standing a server up.
//
// This deliberately does NOT reuse next-auth's provider objects. Those describe
// the SIGN-IN flow, which replaces the session; this slice needs an authorization
// that attaches instead, and it must carry parameters next-auth would not send.

/** The two providers a member may link. Facebook and Twitter exist in NextAuth
 *  but are not part of the identity contract, and Apple/phone in the UI have no
 *  implementation at all (owner decision 8, 2026-09-24: hide them). */
export const LINKABLE = ['google', 'line'] as const
export type LinkableProvider = (typeof LINKABLE)[number]

export function isLinkableProvider(v: unknown): v is LinkableProvider {
  return typeof v === 'string' && (LINKABLE as readonly string[]).includes(v.trim().toLowerCase())
}

/** Provider spelling is asymmetric in storage and it is load-bearing: four
 *  backend queries match a stored literal 'LINE' and would return zero rows with
 *  NO error if it were lower-cased, while nothing anywhere reads a stored
 *  'GOOGLE'. So the write side uses this map and every comparison uses lower().
 *  Same rule as lib/auth/register-login-fe.ts — if you change one, change both. */
export const PROVIDER_SPELLING: Record<LinkableProvider, string> = {
  google: 'google',
  line: 'LINE',
}

export interface ProviderEndpoints {
  authorizeUrl: string
  tokenUrl: string
  /** Where the PUBLIC keys live, for a provider that signs asymmetrically.
   *  `null` means the provider signs its id_token with a SYMMETRIC key — the
   *  client secret we already hold — and there is no key set to fetch. */
  jwksUrl: string | null
  issuers: readonly string[]
  scope: string
  /** Every algorithm this provider's id_token may carry, and nothing else. It
   *  belongs to the provider rather than being shared, because the algorithm and
   *  the key material have to agree — see §ALGORITHM CONFUSION in link-verify.ts. */
  idTokenAlgs: readonly string[]
}

export const ENDPOINTS: Record<LinkableProvider, ProviderEndpoints> = {
  google: {
    authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    jwksUrl: 'https://www.googleapis.com/oauth2/v3/certs',
    // Google mints tokens under both spellings and both are legitimate.
    issuers: ['https://accounts.google.com', 'accounts.google.com'],
    scope: 'openid email profile',
    // Google signs with RS256 against the key set above. It must NEVER accept a
    // symmetric algorithm: the key here is public, so HS256 would let anyone who
    // can read that key mint a token we would believe.
    idTokenAlgs: ['RS256'],
  },
  line: {
    authorizeUrl: 'https://access.line.me/oauth2/v2.1/authorize',
    tokenUrl: 'https://api.line.me/oauth2/v2.1/token',
    // NO JWKS, and this is not an omission. LINE's WEB login signs the id_token
    // with HS256 using the channel secret; the ES256 keys served at
    // https://api.line.me/oauth2/v2.1/certs belong to the native/LIFF/SDK flow,
    // which this is not. Reaching for that key set is what made the first real
    // link attempt fail with `bad-token` on 2026-09-24 at 19:49 ICT: jose
    // rejected the token on its `alg` header before it ever fetched a key.
    // The proof was already in this repo — next-auth's own LINE provider, which
    // drives the sign-in that works in production today, pins
    // `id_token_signed_response_alg: "HS256"`.
    jwksUrl: null,
    issuers: ['https://access.line.me'],
    // NO email scope. The LINE channel's email permission is a separate request
    // that remains with the team, and slice 3 does not need it: owner decision 2
    // says an email may suggest an account but may never bind one.
    scope: 'openid profile',
    // HS256 only, verified against LINE_CLIENT_SECRET. Safe here for the reason
    // it is unsafe for Google: the key is a shared secret only LINE and we hold,
    // never a published public key.
    idTokenAlgs: ['HS256'],
  },
}

export function clientIdFor(provider: LinkableProvider): string {
  const id = provider === 'google' ? process.env.GOOGLE_CLIENT_ID : process.env.LINE_CLIENT_ID
  if (!id) throw new Error(`${provider === 'google' ? 'GOOGLE' : 'LINE'}_CLIENT_ID is not configured`)
  return id
}

export function clientSecretFor(provider: LinkableProvider): string {
  const s = provider === 'google' ? process.env.GOOGLE_CLIENT_SECRET : process.env.LINE_CLIENT_SECRET
  if (!s) throw new Error(`${provider === 'google' ? 'GOOGLE' : 'LINE'}_CLIENT_SECRET is not configured`)
  return s
}

/** The redirect URI must match what is registered on the provider console
 *  CHARACTER FOR CHARACTER, so it is derived from one place and never guessed
 *  from the request's Host header — a forwarded Host would silently produce a
 *  URI the provider rejects, or worse, one an attacker chose. */
export function linkRedirectUri(provider: LinkableProvider, origin?: string): string {
  const base = (origin ?? process.env.NEXTAUTH_URL ?? '').trim().replace(/\/+$/, '')
  if (!base) throw new Error('NEXTAUTH_URL is not configured; the link redirect URI cannot be built')
  return `${base}/api/auth/link/callback/${provider}`
}

export interface AuthorizeParams {
  provider: LinkableProvider
  clientId: string
  redirectUri: string
  state: string
  nonce: string
  codeChallenge: string
}

/** Build the provider's authorization URL.
 *
 *  Two parameters here are not boilerplate and must not be "tidied away":
 *
 *  LINE `disable_ios_auto_login=true` — without it, iOS LINE auto-login switches
 *  to the LINE APP mid-authorize. The cookie jar changes, the state cookie set a
 *  moment earlier is gone at callback, and the flow dies with a black flash back
 *  to the welcome page. That defect (error3.mp4, 2026-09-20) cost this codebase a
 *  live incident. The broader `disable_auto_login` is deliberately NOT used: it
 *  forces LINE's email/password screen and users could not get past it (#728).
 *
 *  Google `prompt=select_account` — the member is linking a SECOND account, and
 *  is by definition already signed in somewhere. Without this, Google silently
 *  reuses whichever account it has and the member links the wrong one with no
 *  chance to choose. There is no undo for a wrong link except unlink, and the
 *  unique index means the identity is occupied until they do.
 */
export function buildAuthorizeUrl(p: AuthorizeParams): string {
  const cfg = ENDPOINTS[p.provider]
  const url = new URL(cfg.authorizeUrl)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('client_id', p.clientId)
  url.searchParams.set('redirect_uri', p.redirectUri)
  url.searchParams.set('scope', cfg.scope)
  url.searchParams.set('state', p.state)
  url.searchParams.set('nonce', p.nonce)
  url.searchParams.set('code_challenge', p.codeChallenge)
  url.searchParams.set('code_challenge_method', 'S256')
  if (p.provider === 'line') url.searchParams.set('disable_ios_auto_login', 'true')
  if (p.provider === 'google') url.searchParams.set('prompt', 'select_account')
  return url.toString()
}

/** LINE's in-app browser identifies itself with "Line/<version>" in the UA, the
 *  same test lib/line/liff.ts:33 uses on the client. Here it runs server-side, on
 *  the request that starts the flow. */
export function isLineWebview(userAgent: string | undefined | null): boolean {
  return /\bLine\//i.test(String(userAgent ?? ''))
}

/** Owner decision 7, 2026-09-24 — the safe option.
 *
 *  Google HARD-BLOCKS OAuth inside embedded browsers (`disallowed_useragent`), a
 *  permanent policy, so a Google link started inside LINE must be escorted to an
 *  external browser. But the external browser is a different cookie jar: it
 *  carries neither the NextAuth session cookie nor our link-state cookie, so the
 *  callback would arrive with nothing to bind the member to — and the only way to
 *  make that work is to trust something the browser supplies, which is exactly
 *  the account-takeover shape this slice refuses.
 *
 *  So we refuse to START, and say why, rather than failing confusingly at the
 *  callback. Linking LINE from inside LINE is fine: the flow stays in one jar.
 */
export function refusalReason(
  provider: LinkableProvider,
  userAgent: string | undefined | null,
): 'line-webview-google' | null {
  if (provider === 'google' && isLineWebview(userAgent)) return 'line-webview-google'
  return null
}
