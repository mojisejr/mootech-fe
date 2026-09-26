import { describe, expect, it } from 'vitest'
import {
  isProviderIdentityConflict,
  normalizeIncomingReferCode,
  RegisterLoginError,
  registerOrLoginInFe,
  type MemberIdentity,
  type ProviderMapping,
  type RegisterLoginStore,
  type RegisterLoginTransaction,
} from '@/lib/auth/register-login-fe'
import { inputFromVerifiedSession } from '@/pages/api/auth/register-login-fe'

class FakeTransaction implements RegisterLoginTransaction {
  mappings: ProviderMapping[] = []
  members = new Map<string, MemberIdentity>()
  locked: string[] = []
  createdMembers: string[] = []
  createdProviders: string[] = []
  activities: string[] = []
  updatedProfiles: string[] = []
  profileUpdates: { userId: string; name: string; email: string; pictureUrl: string }[] = []
  referCodes: string[] = []

  async lockProviderIdentity(provider: string, subject: string) { this.locked.push(`${provider}:${subject}`) }
  async findProviderMappings() { return this.mappings }
  async findMember(userId: string) { return this.members.get(userId) ?? null }
  async updateLoginProfile(input: { userId: string; name: string; email: string; pictureUrl: string }) {
    this.updatedProfiles.push(input.userId)
    this.profileUpdates.push({
      userId: input.userId, name: input.name, email: input.email, pictureUrl: input.pictureUrl,
    })
  }
  async setReferCode(userId: string, referCode: string) {
    this.referCodes.push(`${userId}:${referCode}`)
  }
  async createMember(member: MemberIdentity) {
    this.members.set(member.userId, member)
    this.createdMembers.push(member.userId)
  }
  async createProviderMapping(input: { id: string; userId: string }) {
    this.createdProviders.push(`${input.id}:${input.userId}`)
  }
  async recordSignupActivity(userId: string) { this.activities.push(userId) }
}

const storeOf = (tx: FakeTransaction): RegisterLoginStore => ({
  transaction: async (work) => work(tx),
})

const deps = {
  now: () => new Date('2026-09-23T02:00:00.000Z'),
  makeUserId: () => '00000000-0000-4000-8000-000000000001',
  makeProviderRowId: () => '00000000-0000-4000-8000-000000000002',
  makeReferCode: () => 'ABCDEFGHIJKLMNOPQRST',
}

describe('FE-native register/login', () => {
  it('derives Google identity and profile only from a verified session', () => {
    expect(inputFromVerifiedSession({
      user: { name: 'G', email: 'g@example.com', image: 'g.png' },
      expires: 'x', provider: 'google', providerId: 'google-subject',
    } as any)).toEqual({
      provider: 'google', providerSubject: 'google-subject', name: 'G',
      email: 'g@example.com', pictureUrl: 'g.png', referCode: '',
    })
  })

  it('accepts LINE only when the verified profile subject agrees with providerId', () => {
    const base = { user: { name: 'L' }, expires: 'x', provider: 'line', providerId: 'U1' }
    expect(inputFromVerifiedSession({ ...base, lineProfile: { sub: 'U1' } } as any)?.providerSubject).toBe('U1')
    expect(inputFromVerifiedSession({ ...base, lineProfile: { sub: 'U2' } } as any)).toBeNull()
  })

  it('creates one canonical UUID, provider row, and welcome activity for first login', async () => {
    const tx = new FakeTransaction()
    const result = await registerOrLoginInFe(storeOf(tx), {
      provider: 'google', providerSubject: 'sub-1', name: 'New', email: 'n@example.com', pictureUrl: 'n.png',
    }, deps)
    expect(result).toMatchObject({ ok: true, is_user_new: true, user_id: deps.makeUserId(), ref_code: deps.makeReferCode() })
    expect(tx.locked).toEqual(['google:sub-1'])
    expect(tx.createdMembers).toEqual([deps.makeUserId()])
    expect(tx.createdProviders).toEqual([`${deps.makeProviderRowId()}:${deps.makeUserId()}`])
    expect(tx.activities).toEqual([deps.makeUserId()])
  })

  it('returns an existing provider identity and backfills an empty referral code', async () => {
    const tx = new FakeTransaction()
    tx.mappings = [{ id: 'p1', userId: 'u1' }, { id: 'p2', userId: 'u1' }]
    tx.members.set('u1', { userId: 'u1', name: 'Old', email: '', pictureUrl: null, referCode: '', isRefresh: false, resultCode: '' })
    const result = await registerOrLoginInFe(storeOf(tx), {
      provider: 'LINE', providerSubject: 'U1', name: 'Old', email: '', pictureUrl: '',
    }, deps)
    expect(result).toMatchObject({ is_user_new: false, user_id: 'u1', ref_code: deps.makeReferCode() })
    expect(tx.referCodes).toEqual([`u1:${deps.makeReferCode()}`])
    expect(tx.updatedProfiles).toEqual(['u1'])
    expect(tx.createdMembers).toEqual([])
  })

  it('refuses a cross-user provider collision without writing', async () => {
    const tx = new FakeTransaction()
    tx.mappings = [{ id: 'p1', userId: 'u1' }, { id: 'p2', userId: 'u2' }]
    await expect(registerOrLoginInFe(storeOf(tx), {
      provider: 'google', providerSubject: 'shared', name: '', email: '', pictureUrl: '',
    }, deps)).rejects.toMatchObject({ status: 409 })
    expect(tx.createdMembers).toEqual([])
    expect(tx.updatedProfiles).toEqual([])
  })

  it('refuses an orphan provider row without creating a replacement account', async () => {
    const tx = new FakeTransaction()
    tx.mappings = [{ id: 'p1', userId: 'gone' }]
    await expect(registerOrLoginInFe(storeOf(tx), {
      provider: 'line', providerSubject: 'U-gone', name: '', email: '', pictureUrl: '',
    }, deps)).rejects.toMatchObject({ status: 409 })
    expect(tx.createdMembers).toEqual([])
  })

  it('does not join a first login to an account merely because email matches', async () => {
    const tx = new FakeTransaction()
    tx.members.set('email-owner', { userId: 'email-owner', name: 'Other', email: 'same@example.com', pictureUrl: null, referCode: 'OTHER', isRefresh: false, resultCode: '' })
    const result = await registerOrLoginInFe(storeOf(tx), {
      provider: 'google', providerSubject: 'new-sub', name: 'New', email: 'same@example.com', pictureUrl: '',
    }, deps)
    expect(result.user_id).toBe(deps.makeUserId())
    expect(tx.createdMembers).toEqual([deps.makeUserId()])
  })

  it('refuses an unsupported provider before a transaction write, as an identity rejection', async () => {
    const tx = new FakeTransaction()
    await expect(registerOrLoginInFe(storeOf(tx), {
      provider: 'facebook', providerSubject: 'f', name: '', email: '', pictureUrl: '',
    }, deps)).rejects.toMatchObject({
      status: 400, identityRejected: true,
    } satisfies Partial<RegisterLoginError>)
    expect(tx.locked).toEqual([])
  })

  // The login page writes REFCODE_FGF from `callback`, which defaults to '/',
  // so a non-empty refer_code is the norm and not a referral at all.
  it('reads the login page default as no referral and a real code as a referral', () => {
    expect(normalizeIncomingReferCode(undefined)).toBe('')
    expect(normalizeIncomingReferCode('')).toBe('')
    expect(normalizeIncomingReferCode('  ')).toBe('')
    expect(normalizeIncomingReferCode('/')).toBe('')
    expect(normalizeIncomingReferCode(' INVITE ')).toBe('INVITE')
  })

  // Defect 2: refusing the login over a referral code would have signed out
  // effectively every member at the traffic flip, not an edge case.
  it('logs a member in carrying a referral code instead of refusing the login', async () => {
    for (const referCode of ['/', 'INVITE']) {
      const tx = new FakeTransaction()
      const result = await registerOrLoginInFe(storeOf(tx), {
        provider: 'google', providerSubject: 'sub-ref', name: 'New',
        email: 'n@example.com', pictureUrl: 'n.png', referCode,
      }, deps)
      // Whole response shape, not a subset (DoD 1, revision 0.2).
      expect(result).toEqual({
        ok: true,
        is_user_new: true,
        is_email: true,
        is_info: true,
        user_id: deps.makeUserId(),
        name: 'New',
        ref_code: deps.makeReferCode(),
        picture_url: 'n.png',
        is_refresh: false,
        result_code: '',
      })
      // The referral side effect itself is still not performed here.
      expect(tx.referCodes).toEqual([])
      expect(tx.createdMembers).toEqual([deps.makeUserId()])
    }
  })

  // Defect 3: the live path writes Google lower case and LINE upper case, and
  // four backend queries match a stored 'LINE' exactly.
  it('writes each provider at the spelling the live path already stores', async () => {
    const google = new FakeTransaction()
    await registerOrLoginInFe(storeOf(google), {
      provider: 'GOOGLE', providerSubject: 'g-1', name: 'G', email: 'g@example.com', pictureUrl: '',
    }, deps)
    expect(google.locked).toEqual(['google:g-1'])

    const line = new FakeTransaction()
    await registerOrLoginInFe(storeOf(line), {
      provider: 'line', providerSubject: 'U-1', name: 'L', email: '', pictureUrl: '',
    }, deps)
    expect(line.locked).toEqual(['LINE:U-1'])
  })

  // Defect 4: callers put name and picture straight into a cookie, so a null
  // would reach the member as the literal string "null".
  it('answers an absent name or picture as an empty string, never null', async () => {
    const fresh = new FakeTransaction()
    const created = await registerOrLoginInFe(storeOf(fresh), {
      provider: 'google', providerSubject: 'blank-1', name: '', email: '', pictureUrl: '',
    }, deps)
    expect(created).toEqual({
      ok: true, is_user_new: true, is_email: false, is_info: false,
      user_id: deps.makeUserId(), name: '', ref_code: deps.makeReferCode(),
      picture_url: '', is_refresh: false, result_code: '',
    })

    const returning = new FakeTransaction()
    returning.mappings = [{ id: 'p1', userId: 'u-null' }]
    returning.members.set('u-null', {
      userId: 'u-null', name: null, email: null, pictureUrl: null,
      referCode: 'KEEPKEEPKEEPKEEPKEEP', isRefresh: false, resultCode: '',
    })
    const result = await registerOrLoginInFe(storeOf(returning), {
      provider: 'line', providerSubject: 'U-null', name: '', email: '', pictureUrl: '',
    }, deps)
    expect(result.name).toBe('')
    expect(result.picture_url).toBe('')
  })

  // Defect 5: user_provider.email is the column checkUserWithLine branches on.
  it('never sends a LINE session email into the stored profile', async () => {
    const line = new FakeTransaction()
    line.mappings = [{ id: 'p1', userId: 'u-line' }]
    line.members.set('u-line', {
      userId: 'u-line', name: 'L', email: 'kept@example.com', pictureUrl: null,
      referCode: 'KEEPKEEPKEEPKEEPKEEP', isRefresh: false, resultCode: '',
    })
    await registerOrLoginInFe(storeOf(line), {
      provider: 'LINE', providerSubject: 'U-keep', name: 'L', email: 'line@example.com', pictureUrl: 'l.png',
    }, deps)
    expect(line.profileUpdates).toEqual([
      { userId: 'u-line', name: 'L', email: '', pictureUrl: 'l.png' },
    ])

    const google = new FakeTransaction()
    google.mappings = [{ id: 'p2', userId: 'u-google' }]
    google.members.set('u-google', {
      userId: 'u-google', name: 'G', email: 'old@example.com', pictureUrl: null,
      referCode: 'KEEPKEEPKEEPKEEPKEEP', isRefresh: false, resultCode: '',
    })
    await registerOrLoginInFe(storeOf(google), {
      provider: 'google', providerSubject: 'g-keep', name: 'G', email: 'new@example.com', pictureUrl: '',
    }, deps)
    expect(google.profileUpdates[0].email).toBe('new@example.com')
  })

  // Slice 2: once the unique index exists, a racing caller gets a unique
  // violation instead of silently writing a duplicate. Recovering into the
  // existing-member path is what stops that becoming a retry loop through a 500.
  it('recognises the identity conflict without mistaking other failures for it', () => {
    expect(isProviderIdentityConflict({ code: '23505', constraint_name: 'user_provider_identity_unique' })).toBe(true)
    // A driver that reports no constraint still matches on the code: the recovery
    // re-reads, so a false positive costs a transaction and never a wrong answer.
    expect(isProviderIdentityConflict({ code: '23505' })).toBe(true)
    expect(isProviderIdentityConflict({ code: '23505', constraint_name: 'user_pkey' })).toBe(false)
    // The shape production actually throws: drizzle wraps the driver error in a
    // "Failed query:" error whose own code is undefined. Checking only the top
    // level passes this unit test and never fires in production - found by the
    // real-Postgres proof, not by this file.
    expect(isProviderIdentityConflict(Object.assign(new Error('Failed query: INSERT ...'), {
      cause: Object.assign(new Error('duplicate key'), {
        code: '23505', constraint_name: 'user_provider_identity_unique',
      }),
    }))).toBe(true)
    expect(isProviderIdentityConflict(Object.assign(new Error('Failed query: INSERT ...'), {
      cause: Object.assign(new Error('deadlock'), { code: '40P01' }),
    }))).toBe(false)
    expect(isProviderIdentityConflict({ code: '40001' })).toBe(false)
    expect(isProviderIdentityConflict(new Error('boom'))).toBe(false)
    expect(isProviderIdentityConflict(null)).toBe(false)
  })

  it('retries once into the existing-member path when the index refuses the duplicate', async () => {
    const tx = new FakeTransaction()
    let attempts = 0
    const racingStore: RegisterLoginStore = {
      transaction: async (work) => {
        attempts += 1
        if (attempts === 1) {
          // The other caller won the race and committed while this one was writing.
          tx.mappings = [{ id: 'p1', userId: 'u-winner' }]
          tx.members.set('u-winner', {
            userId: 'u-winner', name: 'Winner', email: 'w@example.com', pictureUrl: 'w.png',
            referCode: 'WINNERWINNERWINNERWI', isRefresh: false, resultCode: '',
          })
          throw Object.assign(new Error('duplicate key value violates unique constraint'), {
            code: '23505', constraint_name: 'user_provider_identity_unique',
          })
        }
        return work(tx)
      },
    }

    const result = await registerOrLoginInFe(racingStore, {
      provider: 'LINE', providerSubject: 'U-race', name: 'Winner', email: '', pictureUrl: 'w.png',
    }, deps)

    expect(attempts).toBe(2)
    expect(result).toMatchObject({ ok: true, is_user_new: false, user_id: 'u-winner' })
    expect(tx.createdMembers).toEqual([])
  })

  it('does not retry a failure that is not the identity conflict', async () => {
    let attempts = 0
    const brokenStore: RegisterLoginStore = {
      transaction: async () => {
        attempts += 1
        throw Object.assign(new Error('connection terminated'), { code: '08006' })
      },
    }
    await expect(registerOrLoginInFe(brokenStore, {
      provider: 'google', providerSubject: 'g-1', name: '', email: '', pictureUrl: '',
    }, deps)).rejects.toThrow('connection terminated')
    expect(attempts).toBe(1)
  })

  // Defect 1: both callers sign the member out on `ok: false`, so a failure they
  // could retry past must not be flagged as an identity rejection.
  it('flags only a refused identity for sign-out, never a recoverable fault', async () => {
    const collision = new FakeTransaction()
    collision.mappings = [{ id: 'p1', userId: 'u1' }, { id: 'p2', userId: 'u2' }]
    await expect(registerOrLoginInFe(storeOf(collision), {
      provider: 'google', providerSubject: 'shared', name: '', email: '', pictureUrl: '',
    }, deps)).rejects.toMatchObject({ status: 409, identityRejected: false })

    const orphan = new FakeTransaction()
    orphan.mappings = [{ id: 'p1', userId: 'gone' }]
    await expect(registerOrLoginInFe(storeOf(orphan), {
      provider: 'line', providerSubject: 'U-gone', name: '', email: '', pictureUrl: '',
    }, deps)).rejects.toMatchObject({ status: 409, identityRejected: false })

    const missingSubject = new FakeTransaction()
    await expect(registerOrLoginInFe(storeOf(missingSubject), {
      provider: 'google', providerSubject: '  ', name: '', email: '', pictureUrl: '',
    }, deps)).rejects.toMatchObject({ status: 400, identityRejected: true })
  })
})
