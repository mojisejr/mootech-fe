import { randomInt, randomUUID } from 'node:crypto'

export type LoginProvider = 'GOOGLE' | 'LINE'

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
  name: string | null
  ref_code: string
  picture_url: string | null
  is_refresh: boolean
  result_code: string
}

export class RegisterLoginError extends Error {
  constructor(
    readonly status: 400 | 409 | 422,
    message: string,
  ) {
    super(message)
    this.name = 'RegisterLoginError'
  }
}

export interface RegisterLoginDependencies {
  now?: () => Date
  makeUserId?: () => string
  makeProviderRowId?: () => string
  makeReferCode?: () => string
}

const SUPPORTED_PROVIDERS = new Set<LoginProvider>(['GOOGLE', 'LINE'])

export function normalizeLoginProvider(value: string): LoginProvider {
  const provider = value.trim().toUpperCase() as LoginProvider
  if (!SUPPORTED_PROVIDERS.has(provider)) {
    throw new RegisterLoginError(400, 'only Google and LINE login are supported')
  }
  return provider
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
    name: member.name,
    ref_code: member.referCode ?? '',
    picture_url: member.pictureUrl,
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
  if (!providerSubject) throw new RegisterLoginError(400, 'provider subject is required')

  // The legacy endpoint performs referral/friend writes while registering. That
  // data belongs to another lane, so this parallel route refuses it explicitly
  // instead of silently dropping or partially reproducing the side effect.
  if ((rawInput.referCode ?? '').trim()) {
    throw new RegisterLoginError(422, 'referral registration is not available on the FE route yet')
  }

  const now = formatLegacyTimestamp((dependencies.now ?? (() => new Date()))())
  const makeUserId = dependencies.makeUserId ?? randomUUID
  const makeProviderRowId = dependencies.makeProviderRowId ?? randomUUID
  const makeReferCode = dependencies.makeReferCode ?? makeAlphabeticReferCode
  const name = rawInput.name.trim()
  const email = rawInput.email.trim()
  const pictureUrl = rawInput.pictureUrl.trim()

  return store.transaction(async (tx) => {
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
        email,
        pictureUrl,
        updatedAt: now,
      })
      return response({ ...member, referCode }, false)
    }

    const member: NewMemberIdentity = {
      userId: makeUserId(),
      name: name || null,
      email: email || null,
      pictureUrl: pictureUrl || null,
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
}
