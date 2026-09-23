import { randomInt, randomUUID } from 'node:crypto'

export type LoginProvider = 'google' | 'LINE'

export interface RegisterLoginInput {
  provider: string
  providerSubject: string
  name: string
  email: string
  pictureUrl: string
  referCode?: string
}

export interface ProviderMapping {
  id: string
  userId: string
}

export interface MemberIdentity {
  userId: string
  name: string | null
  email: string | null
  pictureUrl: string | null
  referCode: string | null
  isRefresh: boolean
  resultCode: string
}

export interface NewMemberIdentity extends MemberIdentity {
  createdAt: string
}

export interface RegisterLoginTransaction {
  lockProviderIdentity(provider: LoginProvider, providerSubject: string): Promise<void>
  findProviderMappings(provider: LoginProvider, providerSubject: string): Promise<ProviderMapping[]>
  findMember(userId: string): Promise<MemberIdentity | null>
  updateLoginProfile(input: {
    provider: LoginProvider
    providerSubject: string
    userId: string
    name: string
    email: string
    pictureUrl: string
    updatedAt: string
  }): Promise<void>
  setReferCode(userId: string, referCode: string, updatedAt: string): Promise<void>
  createMember(member: NewMemberIdentity): Promise<void>
  createProviderMapping(input: {
    id: string
    userId: string
    provider: LoginProvider
    providerSubject: string
    name: string
    email: string
    pictureUrl: string
    createdAt: string
  }): Promise<void>
  recordSignupActivity(userId: string, createdAt: string): Promise<void>
}

export interface RegisterLoginStore {
  transaction<T>(work: (tx: RegisterLoginTransaction) => Promise<T>): Promise<T>
}

export interface RegisterLoginResult {
  ok: true
  is_user_new: boolean
  is_email: boolean
  is_info: boolean
  user_id: string
  name: string
  ref_code: string
  picture_url: string
  is_refresh: boolean
  result_code: string
}

export class RegisterLoginError extends Error {
  constructor(
    readonly status: 400 | 409 | 422,
    message: string,
    /**
     * True only when the provider identity itself is refused — the single case
     * the legacy route flags with `ok: false`. Both callers (home's register
     * handler and lib/auth/use-self-heal-identity) clear the member cookies and
     * call signOut on that flag, so any failure the member could retry past — an
     * ambiguous mapping awaiting manual recovery, a transient database error —
     * must answer WITHOUT it, or a fault logs the member out.
     */
    readonly identityRejected = false,
  ) {
    super(message)
    this.name = 'RegisterLoginError'
  }
}

/**
 * True for the unique violation slice 2's index raises when two callers reach the
 * insert for one provider identity at the same moment. postgres-js exposes the
 * SQLSTATE as `code` and the constraint as `constraint_name`; a driver that gives
 * neither still matches on the code alone, which is the conservative direction -
 * the recovery below re-reads and returns the existing member, so a false positive
 * costs one extra transaction and never a wrong answer.
 */
export function isProviderIdentityConflict(error: unknown): boolean {
  // Walk the cause chain. Drizzle wraps the driver error in a "Failed query:"
  // error whose own `code` is undefined, so a top-level check alone silently
  // never matches - the unit test passes, the production recovery never fires.
  for (let current = error, depth = 0; current != null && depth < 5; depth += 1) {
    if (typeof current !== 'object') return false
    const candidate = current as {
      code?: unknown
      constraint_name?: unknown
      constraint?: unknown
      cause?: unknown
    }
    if (candidate.code === '23505') {
      const constraint = String(candidate.constraint_name ?? candidate.constraint ?? '')
      return constraint === '' || constraint.includes('user_provider_identity')
    }
    current = candidate.cause
  }
  return false
}

export interface RegisterLoginDependencies {
  now?: () => Date
  makeUserId?: () => string
  makeProviderRowId?: () => string
  makeReferCode?: () => string
  isIdentityConflict?: (error: unknown) => boolean
}

/**
 * Spelling is normalised PER PROVIDER, to whatever the live writer already
 * stores: Google lower case, LINE upper case. Do not pick one case for both.
 *
 * Four backend queries match a STORED 'LINE' exactly - the new-member cohort
 * job, the paying-LINE-member audience, checkUserWithLine, and a migration
 * idempotency check - so lower-casing LINE makes all four return zero rows
 * WITHOUT raising an error. No query anywhere reads a stored 'GOOGLE', so
 * lower-casing Google is free. Matching the live spelling also means no
 * production file has to change in the same deploy.
 */
const PROVIDER_SPELLING = new Map<string, LoginProvider>([
  ['GOOGLE', 'google'],
  ['LINE', 'LINE'],
])

export function normalizeLoginProvider(value: string): LoginProvider {
  const spelling = PROVIDER_SPELLING.get(value.trim().toUpperCase())
  if (!spelling) {
    throw new RegisterLoginError(400, 'only Google and LINE login are supported', true)
  }
  return spelling
}

/**
 * The login page writes the REFCODE_FGF cookie from its `callback` query
 * parameter, which DEFAULTS TO '/' — so an ordinary member who never followed a
 * referral link still sends a non-empty refer_code. Treat that default as no
 * referral at all; anything else is a real code this route does not act on.
 */
export function normalizeIncomingReferCode(value: string | undefined): string {
  const code = (value ?? '').trim()
  return code === '/' ? '' : code
}

export function makeAlphabeticReferCode(length = 20): string {
  let result = ''
  for (let i = 0; i < length; i += 1) result += String.fromCharCode(65 + randomInt(26))
  return result
}

export function formatLegacyTimestamp(date: Date): string {
  return date.toLocaleString('sv-SE', {
    timeZone: 'Asia/Bangkok',
    hour12: false,
    hourCycle: 'h23',
  })
}

function response(member: MemberIdentity, isNew: boolean): RegisterLoginResult {
  return {
    ok: true,
    is_user_new: isNew,
    is_email: Boolean(member.email),
    is_info: Boolean(member.name),
    user_id: member.userId,
    // The legacy path writes and returns '' for an absent name or picture.
    // Callers put these straight into a cookie, so a null would reach the
    // member as the literal string "null" where their name should be.
    name: member.name ?? '',
    ref_code: member.referCode ?? '',
    picture_url: member.pictureUrl ?? '',
    is_refresh: member.isRefresh,
    result_code: member.resultCode,
  }
}

/**
 * FE-native register/login identity transaction.
 *
 * This deliberately does not discover or join accounts by email. An OAuth email
 * is profile data, not proof that two provider identities belong to one MuMate
 * member. Explicit account linking is a later, separately owner-gated slice.
 */
export async function registerOrLoginInFe(
  store: RegisterLoginStore,
  rawInput: RegisterLoginInput,
  dependencies: RegisterLoginDependencies = {},
): Promise<RegisterLoginResult> {
  const provider = normalizeLoginProvider(rawInput.provider)
  const providerSubject = rawInput.providerSubject.trim()
  if (!providerSubject) throw new RegisterLoginError(400, 'provider subject is required', true)

  // The legacy endpoint performs referral/friend writes while registering. That
  // data belongs to another lane, so this route performs none of them. It must
  // still never refuse the LOGIN over one. Refusing a non-empty refer_code would
  // have signed out effectively the whole member base at the traffic flip, not
  // an edge case, because of the '/' default described on
  // normalizeIncomingReferCode. The code is ignored; the login proceeds. The
  // parity table states this as a known gap against the legacy route.

  const now = formatLegacyTimestamp((dependencies.now ?? (() => new Date()))())
  const makeUserId = dependencies.makeUserId ?? randomUUID
  const makeProviderRowId = dependencies.makeProviderRowId ?? randomUUID
  const makeReferCode = dependencies.makeReferCode ?? makeAlphabeticReferCode
  const name = rawInput.name.trim()
  const email = rawInput.email.trim()
  const pictureUrl = rawInput.pictureUrl.trim()

  const attempt = () => store.transaction(async (tx) => {
    // The schema does not yet have the unique provider-identity index. Every FE
    // writer therefore takes the same transaction-scoped advisory lock first.
    // Slice 2 adds the DB constraint after existing collisions are resolved.
    await tx.lockProviderIdentity(provider, providerSubject)
    const mappings = await tx.findProviderMappings(provider, providerSubject)
    const userIds = Array.from(new Set(mappings.map((row) => row.userId.trim()).filter(Boolean)))

    if (userIds.length > 1) {
      throw new RegisterLoginError(409, 'identity is ambiguous; manual recovery is required')
    }

    if (userIds.length === 1) {
      const member = await tx.findMember(userIds[0])
      if (!member) {
        throw new RegisterLoginError(409, 'provider identity is orphaned; manual recovery is required')
      }

      let referCode = member.referCode?.trim() ?? ''
      if (!referCode) {
        referCode = makeReferCode()
        await tx.setReferCode(member.userId, referCode, now)
      }
      await tx.updateLoginProfile({
        provider,
        providerSubject,
        userId: member.userId,
        name,
        // LINE sessions carry no email unless the scope is granted, and an
        // empty one must never overwrite a stored address: user_provider.email
        // is the column checkUserWithLine branches on, so blanking it on each
        // LINE login would quietly change that branch. The store treats an
        // empty value as "leave the stored one alone".
        email: provider === 'LINE' ? '' : email,
        pictureUrl,
        updatedAt: now,
      })
      return response({ ...member, referCode }, false)
    }

    const member: NewMemberIdentity = {
      userId: makeUserId(),
      name,
      email,
      pictureUrl,
      referCode: makeReferCode(),
      isRefresh: false,
      resultCode: '',
      createdAt: now,
    }
    await tx.createMember(member)
    await tx.createProviderMapping({
      id: makeProviderRowId(),
      userId: member.userId,
      provider,
      providerSubject,
      name,
      email,
      pictureUrl,
      createdAt: now,
    })
    await tx.recordSignupActivity(member.userId, now)
    return response(member, true)
  })

  const isConflict = dependencies.isIdentityConflict ?? isProviderIdentityConflict
  try {
    return await attempt()
  } catch (error) {
    // Slice 2 adds a unique index on the provider identity, and from then on two
    // callers that reach the insert together no longer both succeed - one gets a
    // unique violation. Left alone that surfaces as a 500 carrying no `ok: false`,
    // which both callers read as "retry", so the member's browser retries straight
    // back into the same race. One retry lands on the existing-member path, which
    // is what the caller wanted in the first place. The advisory lock makes this
    // rare; the index is what makes it correct. Exactly one retry: a second
    // violation would mean something other than this race.
    if (!isConflict(error)) throw error
    return await attempt()
  }
}
