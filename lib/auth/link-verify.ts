// lib/auth/link-verify.ts — turning a provider's ?code into a subject we may trust
// (mumate-login-identity-001 slice 3).
//
// §WHY VERIFY AT ALL, when the code came back from the provider's own redirect.
// The redirect is a browser navigation. Anything in the browser can produce one.
// Without verification the callback would accept a `code` chosen by whoever sent
// the member there, and the whole flow reduces to "tell me a subject and I will
// attach it to your account". The signature, the issuer, the audience, the expiry
// and the nonce each close one way of doing exactly that:
//   signature  the token was minted by the provider, not written by the caller
//   issuer     by THAT provider, not another one with a valid-looking token
//   audience   for THIS client, not a token harvested from a different app
//   expiry     now, not a token captured months ago
//   nonce      for THIS request, not replayed from an earlier successful login
//
// §WE USE jose RATHER THAN HAND-ROLLING. jose is already in the tree (next-auth
// depends on it) and is now a direct dependency so the reliance is declared
// rather than accidental. Hand-written JWT verification is a well-known source of
// subtle, silent holes — algorithm confusion, an unchecked `kid`, a `none` alg
// accepted by a permissive parser — and the owner's standing rule for this
// workstream is to take the option that is not risky.
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose'

import {
  ENDPOINTS,
  clientIdFor,
  clientSecretFor,
  type LinkableProvider,
} from './link-providers'

// §ALGORITHM CONFUSION, and why the allowlist is per provider rather than global.
//
// The attack an allowlist exists to stop is this: a provider publishes a PUBLIC
// signing key, we accept HS256, and an attacker signs their own token using that
// published key as the HMAC secret. We verify it, because we hold the same bytes.
// The defence is not "never HS256" — it is that the algorithm and the key must
// agree, and that pairing is a property of the PROVIDER, not of the codebase:
//
//   google  RS256, key = the public JWKS      → HS256 here would be the attack
//   line    HS256, key = LINE_CLIENT_SECRET   → RS256 here has no key to use
//
// A single shared allowlist cannot express that, and the first version of this
// file proved it: it allowed RS256/ES256 for everyone and so could never verify
// any LINE web token at all. Each provider now carries its own `idTokenAlgs` and
// its own key material, and neither is reachable from the other.

export interface VerifiedIdentity {
  /** the provider's STABLE subject: Google's `sub`, LINE's userId */
  subject: string
  email: string
  name: string
  pictureUrl: string
}

export type VerifyFailure =
  | 'token-exchange-failed'
  | 'no-id-token'
  | 'bad-token'
  | 'nonce-mismatch'
  | 'no-subject'

export type VerifyResult =
  | { ok: true; value: VerifiedIdentity }
  | { ok: false; reason: VerifyFailure }

// One JWKS client per provider, created lazily and reused: it caches the keys and
// rate-limits refetches, so a burst of links does not hammer the provider's
// certificate endpoint (and a key rotation is picked up on its own). Only
// providers that publish a key set appear here; a symmetric one never does.
const jwks = new Map<LinkableProvider, ReturnType<typeof createRemoteJWKSet>>()

function keySetFor(provider: LinkableProvider, jwksUrl: string) {
  let set = jwks.get(provider)
  if (!set) {
    set = createRemoteJWKSet(new URL(jwksUrl))
    jwks.set(provider, set)
  }
  return set
}

export interface ExchangeDeps {
  fetch?: typeof globalThis.fetch
  /** injected in tests so a fixture token can be checked without reaching a provider */
  verifyToken?: (provider: LinkableProvider, token: string) => Promise<JWTPayload>
}

export async function defaultVerify(provider: LinkableProvider, token: string): Promise<JWTPayload> {
  const { jwksUrl, issuers, idTokenAlgs } = ENDPOINTS[provider]
  // Same options either way; only the KEY differs, and which key it is follows
  // from `jwksUrl` alone. The two branches are written out rather than folded
  // into one call because a union of key types matches neither jwtVerify
  // overload — and because the split is the point: a symmetric key and a remote
  // key set are never interchangeable.
  const options = {
    issuer: [...issuers],
    audience: clientIdFor(provider),
    algorithms: [...idTokenAlgs],
  }
  const { payload } =
    jwksUrl === null
      ? await jwtVerify(token, new TextEncoder().encode(clientSecretFor(provider)), options)
      : await jwtVerify(token, keySetFor(provider, jwksUrl), options)
  return payload
}

/**
 * Exchange the authorization code and verify the id_token that comes back.
 *
 * The PKCE `code_verifier` is sent here and nowhere else; it is the proof that
 * this is the same flow that requested the code, which is what makes a stolen
 * code useless on its own.
 */
export async function exchangeAndVerify(
  provider: LinkableProvider,
  args: { code: string; codeVerifier: string; redirectUri: string; nonce: string },
  deps: ExchangeDeps = {},
): Promise<VerifyResult> {
  const doFetch = deps.fetch ?? globalThis.fetch
  const verify = deps.verifyToken ?? defaultVerify

  let idToken: string
  try {
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code: args.code,
      redirect_uri: args.redirectUri,
      client_id: clientIdFor(provider),
      client_secret: clientSecretFor(provider),
      code_verifier: args.codeVerifier,
    })
    const response = await doFetch(ENDPOINTS[provider].tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    })
    if (!response.ok) return { ok: false, reason: 'token-exchange-failed' }
    const payload = (await response.json()) as { id_token?: unknown }
    if (typeof payload?.id_token !== 'string' || payload.id_token === '') {
      return { ok: false, reason: 'no-id-token' }
    }
    idToken = payload.id_token
  } catch {
    return { ok: false, reason: 'token-exchange-failed' }
  }

  let claims: JWTPayload
  try {
    claims = await verify(provider, idToken)
  } catch {
    // Signature, issuer, audience, expiry and algorithm all land here. They are
    // reported as one reason on purpose: telling a caller WHICH check failed
    // helps them craft the next attempt and helps a member not at all.
    return { ok: false, reason: 'bad-token' }
  }

  // jose verifies the standard claims; the nonce is ours and must be checked here.
  // Without it, an id_token captured from an earlier legitimate sign-in could be
  // replayed into a fresh link.
  if (typeof claims.nonce !== 'string' || claims.nonce !== args.nonce) {
    return { ok: false, reason: 'nonce-mismatch' }
  }

  const subject = typeof claims.sub === 'string' ? claims.sub.trim() : ''
  if (!subject) return { ok: false, reason: 'no-subject' }

  const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')
  return {
    ok: true,
    value: {
      subject,
      // LINE never sends one without the email permission the team still holds;
      // an absent email is '' and is never written as though it were real.
      email: str(claims.email),
      name: str(claims.name),
      pictureUrl: str(claims.picture),
    },
  }
}
