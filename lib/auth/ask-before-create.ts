// lib/auth/ask-before-create.ts — ask before a second account is created
// (mumate-login-identity-001 slice 5, numbered 4b until plan 0.8).
//
// §WHAT THIS STOPS. The only path that creates members in production is the global
// self-heal (lib/auth/use-self-heal-identity.ts): a signed session with no MEMBER_ID
// calls the legacy register-login, which creates a member for ANY identity it cannot
// find. A member who first used LINE and later taps Google is therefore handed a new,
// empty account without a word. From here the self-heal asks first: when the session's
// identity has no owner, the member is sent to WELCOME_BACK_PATH and asked whether they
// have used MuMate with the other provider. Never inferred — owner decision 2 forbids
// treating a matching email as proof, and LINE carries no email here in any case.
//
// §WHY IT FAILS OPEN. Every failure here — switch off, status unreachable, a timeout, a
// response we do not understand — falls back to today's behaviour (register). The cost
// of failing open is one more duplicate account, which slice 4's merge repairs. The
// cost of failing closed is a member who cannot get in at all.
//
// Pure except fetchIdentityStatus, so the rules are tested without a server or DOM.

/** Where a member with an unowned identity is asked. */
export const WELCOME_BACK_PATH = '/v2/welcome-back'

/** Server switch, owner decision 20: default OFF, released in two steps (merge, then
 *  set and redeploy). Off must be today's behaviour. */
export const ASK_BEFORE_CREATE_ENV = 'LOGIN_ASK_BEFORE_CREATE'

const ON_VALUES = new Set(['on', 'true', '1', 'yes', 'enabled'])

export function isAskBeforeCreateEnabled(raw: string | undefined | null): boolean {
  return ON_VALUES.has(String(raw ?? '').trim().toLowerCase())
}

export type AskableProvider = 'google' | 'line'

export function asAskableProvider(raw: string | null | undefined): AskableProvider | null {
  const p = String(raw ?? '').trim().toLowerCase()
  return p === 'google' || p === 'line' ? p : null
}

export function otherProvider(p: AskableProvider): AskableProvider {
  return p === 'google' ? 'line' : 'google'
}

export const PROVIDER_LABEL: Record<AskableProvider, string> = { google: 'Google', line: 'LINE' }

export interface IdentityStatus {
  signedIn: boolean
  /** true: the identity has an owner · false: nobody owns it · null: not decidable (signed out, ambiguous) */
  known: boolean | null
  /** Ask the member before creating. Only ever true for an unowned Google/LINE identity with the switch on. */
  ask: boolean
  provider: AskableProvider | null
}

/** The server's verdict, from the session's provider and resolveSignedSessionUserId's result.
 *  Ambiguous identities (409) are never interrupted: that is not "unowned", and asking
 *  would offer a link that cannot resolve. */
export function decideIdentityStatus(input: {
  provider: string | null | undefined
  resolved: { ok: true } | { ok: false; status: number } | null
  enabled: boolean
}): IdentityStatus {
  const provider = asAskableProvider(input.provider)
  const r = input.resolved
  if (!r || (!r.ok && r.status === 401)) return { signedIn: false, known: null, ask: false, provider }
  if (r.ok) return { signedIn: true, known: true, ask: false, provider }
  if (r.status === 404) return { signedIn: true, known: false, ask: input.enabled && provider !== null, provider }
  return { signedIn: true, known: null, ask: false, provider }
}

// ---- the member's "create new" choice, remembered for this tab ----

/** sessionStorage, not localStorage: a choice made in one tab should not silently apply
 *  to a different sign-in tomorrow. Keyed by the exact identity, so choosing "new" for
 *  one Google account does not skip the question for another. */
export const CHOICE_KEY = 'mumate:identity-choice'

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>

function choiceToken(provider: string, subject: string): string {
  return `${provider.trim().toLowerCase()}:${subject.trim()}`
}

export function rememberCreateNew(storage: StorageLike | null | undefined, provider: string, subject: string): void {
  try {
    storage?.setItem(CHOICE_KEY, choiceToken(provider, subject))
  } catch {
    // storage blocked (private mode): the question will simply be asked again
  }
}

export function hasChosenCreateNew(storage: StorageLike | null | undefined, provider: string, subject: string): boolean {
  try {
    return storage?.getItem(CHOICE_KEY) === choiceToken(provider, subject)
  } catch {
    return false
  }
}

// ---- client read, fail-open ----

export const IDENTITY_STATUS_TIMEOUT_MS = 4000

/** GET /api/auth/identity-status. null on ANY failure — the caller treats null as "do
 *  not ask", which is today's behaviour. */
export async function fetchIdentityStatus(
  fetchImpl: typeof fetch = fetch,
  timeoutMs: number = IDENTITY_STATUS_TIMEOUT_MS,
): Promise<IdentityStatus | null> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    const timeout = new Promise<null>((resolve) => {
      timer = setTimeout(() => resolve(null), timeoutMs)
    })
    const call = (async () => {
      const res = await fetchImpl('/api/auth/identity-status', { credentials: 'same-origin', cache: 'no-store' })
      if (!res.ok) return null
      const body = (await res.json()) as Partial<IdentityStatus> | null
      if (!body || typeof body.ask !== 'boolean') return null
      return {
        signedIn: body.signedIn === true,
        known: typeof body.known === 'boolean' ? body.known : null,
        ask: body.ask,
        provider: asAskableProvider(body.provider ?? null),
      }
    })()
    return await Promise.race([call, timeout])
  } catch {
    return null
  } finally {
    if (timer) clearTimeout(timer)
  }
}

/** The link start URL that attaches `provider` to whoever the session now resolves to,
 *  landing on the connected screen, which already reports every outcome in words. */
export function linkStartUrl(provider: AskableProvider): string {
  return `/api/auth/link/start/${provider}?return_to=${encodeURIComponent('/v2/settings/connected')}`
}
