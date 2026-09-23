import { describe, expect, it } from 'vitest'
import {
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
  referCodes: string[] = []

  async lockProviderIdentity(provider: string, subject: string) { this.locked.push(`${provider}:${subject}`) }
  async findProviderMappings() { return this.mappings }
  async findMember(userId: string) { return this.members.get(userId) ?? null }
  async updateLoginProfile(input: { userId: string }) { this.updatedProfiles.push(input.userId) }
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
    expect(tx.locked).toEqual(['GOOGLE:sub-1'])
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
