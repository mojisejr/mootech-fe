// scripts/liff-carry-s7g.test.ts — mumate-login-identity slice 7g (2026-10-02): "ใบส่งต่อ" ให้คนที่สมัครผ่าน LIFF.
//
// 🔴 MUTANT CONTRACT:
//   C1 ใบปลอม/หมดอายุ/คนละ secret → ใช้ไม่ได้                                   ❌ ใครก็ผูก LINE ใหม่เข้าบัญชีคนอื่นได้
//   C2 sub ใหม่ไม่มีเจ้าของ + ใบใช้ได้ + บัญชีสร้างในช่วง LIFF + LINE แถวเดียว → ผูกเข้าบัญชีเดิม ไม่สร้างใหม่
//   C3 บัญชีนอกช่วง LIFF / มี LINE 2 แถวแล้ว / provider Google → สร้างบัญชีใหม่ตามเดิม (ใบไม่มีผล)
//   C4 sub มีเจ้าของอยู่แล้ว (สมาชิกเดิมที่ได้บัญชีซ้ำ) → เข้าบัญชีเจ้าของ ใบไม่มีผล
//   C5 มีใบ → identity-status ไม่ถาม "เคยใช้มาก่อนไหม"
import { describe, expect, it } from 'vitest'
import {
  LIFF_WINDOW,
  appendSetCookie,
  carryClearCookie,
  carryCookieName,
  carrySetCookie,
  isInLiffWindow,
  isLiffEraLineProfile,
  readCarry,
  signCarry,
  verifyCarry,
} from '@/lib/auth/liff-carry'
import {
  registerOrLoginInFe,
  type MemberIdentity,
  type ProviderMapping,
  type RegisterLoginStore,
  type RegisterLoginTransaction,
} from '@/lib/auth/register-login-fe'
import { decideIdentityStatus } from '@/lib/auth/ask-before-create'

const SECRET = 'test-secret'
const NOW = 1_790_000_000
const MEMBER = '11111111-1111-4111-8111-111111111111'

describe('signCarry / verifyCarry (C1)', () => {
  const token = signCarry({ u: MEMBER, exp: NOW + 60 }, SECRET)
  it('ใบที่ถูกต้อง → payload', () => {
    expect(verifyCarry(token, SECRET, NOW)).toEqual({ u: MEMBER, exp: NOW + 60 })
  })
  it('หมดอายุ / คนละ secret / แก้ body / แก้ลายเซ็น / รูปไม่ครบ → null', () => {
    expect(verifyCarry(token, SECRET, NOW + 60)).toBeNull()
    expect(verifyCarry(token, 'other', NOW)).toBeNull()
    const [body, sig] = token.split('.')
    const forged = Buffer.from(JSON.stringify({ u: '22222222-2222-4222-8222-222222222222', exp: NOW + 60 })).toString('base64url')
    expect(verifyCarry(`${forged}.${sig}`, SECRET, NOW)).toBeNull()
    expect(verifyCarry(`${body}.${sig.slice(0, -2)}xx`, SECRET, NOW)).toBeNull()
    expect(verifyCarry(body, SECRET, NOW)).toBeNull()
    expect(verifyCarry(`${token}.x`, SECRET, NOW)).toBeNull()
    expect(verifyCarry('', SECRET, NOW)).toBeNull()
    expect(verifyCarry(token, '', NOW)).toBeNull()
  })
  it('u ต้องเป็น uuid', () => {
    expect(verifyCarry(signCarry({ u: 'not-a-uuid', exp: NOW + 60 }, SECRET), SECRET, NOW)).toBeNull()
  })
  it('readCarry อ่านจากชื่อ cookie ตาม secure', () => {
    expect(readCarry({ [carryCookieName(true)]: token }, SECRET, true, NOW)?.u).toBe(MEMBER)
    expect(readCarry({ [carryCookieName(false)]: token }, SECRET, true, NOW)).toBeNull()
    expect(readCarry({}, SECRET, true, NOW)).toBeNull()
  })
  it('cookie: httpOnly, path /api/auth, 30 นาที; ล้าง = Max-Age=0', () => {
    expect(carrySetCookie('t', true)).toBe('__Secure-mumate.liff-carry=t; Path=/api/auth; Max-Age=1800; HttpOnly; SameSite=Lax; Secure')
    expect(carryClearCookie(true)).toContain('Max-Age=0')
  })
  it('appendSetCookie ไม่ทับ session cookie ที่ตั้งไว้ก่อน', () => {
    const headers: Record<string, unknown> = { 'Set-Cookie': 'session=1' }
    const res = { getHeader: (n: string) => headers[n], setHeader: (n: string, v: unknown) => { headers[n] = v } }
    appendSetCookie(res, 'carry=2')
    expect(headers['Set-Cookie']).toEqual(['session=1', 'carry=2'])
  })
})

describe('isInLiffWindow / isLiffEraLineProfile', () => {
  it('ช่วงจริงของ LIFF login', () => {
    expect(isInLiffWindow(LIFF_WINDOW.start)).toBe(true)
    expect(isInLiffWindow('2026-09-30 12:00:00')).toBe(true)
    expect(isInLiffWindow('2026-10-01 17:26:31')).toBe(true) // #860 ขึ้น production
    expect(isInLiffWindow('2026-09-28 21:41:54')).toBe(false)
    expect(isInLiffWindow(LIFF_WINDOW.end)).toBe(false)
    expect(isInLiffWindow('2026-07-22 18:11:46')).toBe(false)
    expect(isInLiffWindow('garbage')).toBe(false)
    expect(isInLiffWindow(null)).toBe(false)
  })
  it('LIFF session = มี sub ไม่มี iss', () => {
    expect(isLiffEraLineProfile({ sub: 'U1' })).toBe(true)
    expect(isLiffEraLineProfile({ sub: 'U1', iss: 'https://access.line.me' })).toBe(false)
    expect(isLiffEraLineProfile({})).toBe(false)
    expect(isLiffEraLineProfile(null)).toBe(false)
  })
})

class Tx implements RegisterLoginTransaction {
  mappings: ProviderMapping[] = []
  members = new Map<string, MemberIdentity>()
  targets = new Map<string, { createAt: string; lineRows: number }>()
  created: string[] = []
  mapped: string[] = []
  activities: string[] = []
  async lockProviderIdentity() {}
  async findProviderMappings() { return this.mappings }
  async findMember(userId: string) { return this.members.get(userId) ?? null }
  async updateLoginProfile() {}
  async setReferCode() {}
  async createMember(m: MemberIdentity) { this.members.set(m.userId, m); this.created.push(m.userId) }
  async createProviderMapping(i: { userId: string; provider: string }) { this.mapped.push(`${i.provider}:${i.userId}`) }
  async recordSignupActivity(userId: string) { this.activities.push(userId) }
  async findCarryTarget(userId: string) { return this.targets.get(userId) ?? null }
}
const storeOf = (tx: Tx): RegisterLoginStore => ({ transaction: async (work) => work(tx) })
const deps = {
  now: () => new Date('2026-10-02T02:00:00.000Z'),
  makeUserId: () => '99999999-9999-4999-8999-999999999999',
  makeProviderRowId: () => 'row-1',
  makeReferCode: () => 'NEWCODE',
}
const lineLogin = { provider: 'line', providerSubject: 'U-LOGIN', name: 'คนเดิม', email: '', pictureUrl: 'https://profile.line-scdn.net/x' }

function windowMember(tx: Tx, lineRows = 1, createAt = '2026-09-30 12:00:00') {
  tx.members.set(MEMBER, {
    userId: MEMBER, name: 'คนเดิม', email: null, pictureUrl: null, referCode: 'MUMATE190', isRefresh: false, resultCode: '',
  })
  tx.targets.set(MEMBER, { createAt, lineRows })
}

describe('registerOrLoginInFe + ใบส่งต่อ', () => {
  it('C2: sub ใหม่ไม่มีเจ้าของ + ใบ → ผูกเข้าบัญชีเดิม ไม่สร้างบัญชีใหม่', async () => {
    const tx = new Tx()
    windowMember(tx)
    const r = await registerOrLoginInFe(storeOf(tx), { ...lineLogin, carryToUserId: MEMBER }, deps)
    expect(r.user_id).toBe(MEMBER)
    expect(r.is_user_new).toBe(false)
    expect(r.carried).toBe(true)
    expect(r.ref_code).toBe('MUMATE190')
    expect(tx.created).toEqual([])
    expect(tx.activities).toEqual([])
    expect(tx.mapped).toEqual([`LINE:${MEMBER}`])
  })

  it('C3: บัญชีนอกช่วง LIFF → สร้างบัญชีใหม่ตามเดิม', async () => {
    const tx = new Tx()
    windowMember(tx, 1, '2026-07-22 18:11:46')
    const r = await registerOrLoginInFe(storeOf(tx), { ...lineLogin, carryToUserId: MEMBER }, deps)
    expect(r.user_id).toBe(deps.makeUserId())
    expect(r.is_user_new).toBe(true)
    expect(r.carried).toBeUndefined()
  })

  it('C3: บัญชีมี LINE 2 แถวแล้ว (ได้ sub ช่อง Login ไปแล้ว) → สร้างบัญชีใหม่ตามเดิม', async () => {
    const tx = new Tx()
    windowMember(tx, 2)
    const r = await registerOrLoginInFe(storeOf(tx), { ...lineLogin, carryToUserId: MEMBER }, deps)
    expect(r.is_user_new).toBe(true)
  })

  it('C3: Google + ใบ → ใบไม่มีผล', async () => {
    const tx = new Tx()
    windowMember(tx)
    const r = await registerOrLoginInFe(storeOf(tx), { ...lineLogin, provider: 'google', carryToUserId: MEMBER }, deps)
    expect(r.is_user_new).toBe(true)
    expect(r.user_id).not.toBe(MEMBER)
  })

  it('C3: บัญชีในใบหายไปแล้ว → สร้างบัญชีใหม่ตามเดิม', async () => {
    const tx = new Tx()
    const r = await registerOrLoginInFe(storeOf(tx), { ...lineLogin, carryToUserId: MEMBER }, deps)
    expect(r.is_user_new).toBe(true)
  })

  it('C4: sub มีเจ้าของแล้ว (สมาชิกเดิมที่ได้บัญชีซ้ำ) → เข้าบัญชีเจ้าของ ใบไม่มีผล', async () => {
    const tx = new Tx()
    windowMember(tx)
    const OWNER = '33333333-3333-4333-8333-333333333333'
    tx.members.set(OWNER, { userId: OWNER, name: 'เจ้าของ', email: null, pictureUrl: null, referCode: 'R', isRefresh: false, resultCode: '' })
    tx.mappings = [{ id: 'p', userId: OWNER }]
    const r = await registerOrLoginInFe(storeOf(tx), { ...lineLogin, carryToUserId: MEMBER }, deps)
    expect(r.user_id).toBe(OWNER)
    expect(r.carried).toBeUndefined()
    expect(tx.mapped).toEqual([])
  })
})

describe('decideIdentityStatus + ใบ (C5)', () => {
  it('LINE ไม่มีเจ้าของ + มีใบ → ไม่ถาม; ไม่มีใบ → ถามตามเดิม', () => {
    const resolved = { ok: false as const, status: 404 }
    expect(decideIdentityStatus({ provider: 'line', resolved, enabled: true, carry: true }).ask).toBe(false)
    expect(decideIdentityStatus({ provider: 'line', resolved, enabled: true, carry: false }).ask).toBe(true)
    expect(decideIdentityStatus({ provider: 'google', resolved, enabled: true, carry: true }).ask).toBe(true)
  })
})
