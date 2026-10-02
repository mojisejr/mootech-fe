// mumate-member-identity-hardening-001 slice 1 step 2 — routes that used to take the member's identity
// from cookie-mumate-id directly now take it from the signed session (or the sealed #391 fallback).
//
// One harness, every route. Only the transport is mocked (session, db, fetch); each handler runs for real.
// The property is about what LEAVES the handler: another member's user_id must never reach a bazi call,
// a database parameter, or the response — whether it arrives as a bare cookie with no session, or as a
// cookie that disagrees with the session.
//
// 🔴 MUTANT CONTRACT: restore any one route's original `req.cookies['cookie-mumate-id']` read and its cases
// redden (the other member's id leaves the handler); drop the mismatch check in resolveRouteMember and every
// required route's "mismatch" case reddens. (Reading the cookie AFTER resolveRouteMember is not a leak:
// the mismatch check has already made it equal to the caller.)
import { describe, it, expect, vi, beforeEach } from 'vitest'

const h = vi.hoisted(() => {
  const state = {
    session: null as null | { providerId: string; provider: string },
    providerRows: [] as Array<{ user_id: string }>,
  }
  const outbound: string[] = []
  const deepText = (v: unknown): string => {
    const seen = new WeakSet()
    try {
      return JSON.stringify(v, (_k, x) => {
        if (typeof x === 'object' && x !== null) {
          if (seen.has(x)) return undefined
          seen.add(x)
        }
        return typeof x === 'bigint' ? String(x) : x
      }) ?? String(v)
    } catch {
      return String(v)
    }
  }
  const db = {
    execute: vi.fn(async (q: unknown) => {
      const text = deepText(q)
      outbound.push(`db:${text}`)
      if (text.includes('FROM user_provider')) return state.providerRows
      if (text.includes('FROM \\"user\\" WHERE user_id')) {
        return state.providerRows.length ? [{ user_id: state.providerRows[0].user_id }] : []
      }
      return []
    }),
  }
  return { state, outbound, deepText, db, getServerSession: vi.fn(async () => state.session) }
})

vi.mock('next-auth/next', () => ({ getServerSession: h.getServerSession }))
vi.mock('@/pages/api/auth/[...nextauth]', () => ({ authOptions: {}, default: () => undefined }))
vi.mock('@/lib/db', () => ({ db: h.db }))

import { memberSealCookieName, signMemberSeal, MEMBER_SEAL_TTL_SECONDS } from '@/lib/auth/member-seal'
import { isSecureDeploy } from '@/lib/auth/liff-carry'

const SECRET = 'member-routes-test-secret'
process.env.NEXTAUTH_SECRET = SECRET
process.env.BAZI_BASE_URL = 'http://bazi.test'
process.env.BAZI_CLIENT_ID_SECRET = 'client-secret-test'
process.env.BAZI_CHAT_PUBLIC = 'true' // chat/access echoes the member's id only when the chat is open to them

const A = '11111111-2222-4333-8444-555555555555' // the caller
const OTHER = '99999999-8888-4777-8666-555555555555' // someone else
const SEAL = memberSealCookieName(isSecureDeploy())
const sealFor = (u: string) => signMemberSeal({ u, exp: Math.floor(Date.now() / 1000) + MEMBER_SEAL_TTL_SECONDS }, SECRET)

type Route = { path: string; methods: string[]; optional?: boolean; body?: Record<string, unknown> }

// optional = the route also serves anonymous callers (no member data), so a refused identity is
// "anonymous", not 401.
const ROUTES: Route[] = [
  { path: 'pages/api/account-export', methods: ['GET'] },
  { path: 'pages/api/bazi/element-summary', methods: ['POST'], optional: true },
  { path: 'pages/api/chat/access', methods: ['GET'], optional: true },
  { path: 'pages/api/chat/bazi', methods: ['POST'], optional: true },
  { path: 'pages/api/chat/quota', methods: ['GET'] },
  { path: 'pages/api/consent', methods: ['GET', 'POST'] },
  { path: 'pages/api/coupon-redeem', methods: ['POST'] },
  { path: 'pages/api/destiny', methods: ['POST'] },
  { path: 'pages/api/fortune/divine', methods: ['POST'] },
  { path: 'pages/api/fortune/oracle', methods: ['POST'] },
  { path: 'pages/api/fortune/sage', methods: ['POST'] },
  { path: 'pages/api/home-fortune', methods: ['POST'], optional: true },
  { path: 'pages/api/missions', methods: ['GET', 'POST'] },
  { path: 'pages/api/notification-prefs', methods: ['GET', 'PUT'] },
  { path: 'pages/api/prayer', methods: ['POST'], optional: true },
  { path: 'pages/api/profile', methods: ['GET', 'PATCH', 'POST'] },
  { path: 'pages/api/qi-earn', methods: ['POST'] },
  { path: 'pages/api/qi-entitlements', methods: ['GET'] },
  { path: 'pages/api/qi-spend', methods: ['POST'] },
  { path: 'pages/api/qi-streak-restore', methods: ['POST'] },
  { path: 'pages/api/qi-wallet', methods: ['GET'] },
  { path: 'pages/api/referral', methods: ['GET', 'POST'] },
  { path: 'pages/api/v2/account/delete', methods: ['GET', 'DELETE'] },
  { path: 'pages/api/v2/analytics/identity', methods: ['GET'] },
  { path: 'pages/api/v2/avatar', methods: ['GET'] },
  { path: 'pages/api/v2/display-name', methods: ['GET', 'POST'] },
  { path: 'pages/api/v2/manifest/checkin', methods: ['POST'] },
  { path: 'pages/api/v2/manifest/entry', methods: ['GET', 'POST'] },
  { path: 'pages/api/v2/manifest/goals', methods: ['GET', 'POST', 'PATCH', 'DELETE'] },
  { path: 'pages/api/v2/manifest/photo', methods: ['GET'] },
  { path: 'pages/api/v2/phone-charge', methods: ['POST'] },
]

const BODY = {
  code: 'TESTCODE',
  ref: 'REF',
  message: 'hi',
  messages: [{ role: 'user', content: 'hi' }],
  person: { birthDate: '1990-01-01', birthTime: '10:00', dob: '1990-01-01', time: '10:00', gender: 'male' },
  name: 'n',
  displayName: 'n',
  question: 'q',
  goal: 'g',
  text: 't',
  phone: '0812345678',
}

async function call(route: Route, method: string, cookies: Record<string, string>) {
  const mod = (await import(`@/${route.path}`)) as { default: (req: unknown, res: unknown) => unknown }
  const out = { status: 200, body: undefined as unknown, headers: {} as Record<string, unknown> }
  const res: Record<string, unknown> = {}
  Object.assign(res, {
    statusCode: 200,
    status(c: number) {
      out.status = c
      res.statusCode = c
      return res
    },
    json(b: unknown) {
      out.body = b
      return res
    },
    send(b: unknown) {
      out.body = b
      return res
    },
    end(b?: unknown) {
      if (b !== undefined) out.body = b
      return res
    },
    setHeader(n: string, v: unknown) {
      out.headers[n.toLowerCase()] = v
      return res
    },
    getHeader: (n: string) => out.headers[n.toLowerCase()],
    write: () => true,
    flushHeaders: () => undefined,
    on: () => res,
    once: () => res,
    writeHead(c: number) {
      out.status = c
      return res
    },
  })
  const req = {
    method,
    query: { history: '5' },
    body: { ...route.body, ...BODY },
    cookies,
    headers: { 'content-type': 'application/json', host: 'localhost' },
    on: () => req,
    socket: { remoteAddress: '127.0.0.1' },
  }
  await mod.default(req, res)
  return { out, leaked: () => h.outbound.some((s) => s.includes(OTHER)) || h.deepText(out.body).includes(OTHER) }
}

// served = not refused for identity (a route may still answer 409 profile_incomplete etc. on mock data)
function expectServed(out: { status: number; body: unknown }) {
  expect(out.status).not.toBe(401)
  expect((out.body as { reason?: string } | undefined)?.reason).not.toBe('identity')
}

const fetchMock = vi.fn(async (url: unknown, init?: { body?: unknown }) => {
  h.outbound.push(`fetch:${String(url)} ${typeof init?.body === 'string' ? init.body : h.deepText(init?.body)}`)
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'content-type': 'application/json' } })
})

beforeEach(() => {
  h.state.session = null
  h.state.providerRows = []
  h.outbound.length = 0
  h.db.execute.mockClear()
  fetchMock.mockClear()
  vi.stubGlobal('fetch', fetchMock)
})

describe.each(ROUTES.flatMap((r) => r.methods.map((m) => [`${m} ${r.path.replace('pages', '')}`, r, m] as const)))(
  '%s',
  (_name, route, method) => {
    it('bare cookie: a cookie naming another member, no session ⇒ nothing about them leaves the handler', async () => {
      const { out, leaked } = await call(route, method, { 'cookie-mumate-id': OTHER })
      expect(leaked()).toBe(false)
      if (!route.optional) expect(out.status).toBe(401)
    })

    it('mismatch: signed in as A with a cookie naming another member ⇒ refused (409) or anonymous, nothing leaks', async () => {
      h.state.session = { providerId: 'U-A', provider: 'line' }
      h.state.providerRows = [{ user_id: A }]
      const { out, leaked } = await call(route, method, { 'cookie-mumate-id': OTHER })
      expect(leaked()).toBe(false)
      if (!route.optional) {
        expect(out.status).toBe(409)
        expect((out.body as { reason?: string })?.reason).toBe('identity')
      }
    })

    it('own: signed in as A with A\'s cookie ⇒ served as A', async () => {
      h.state.session = { providerId: 'U-A', provider: 'line' }
      h.state.providerRows = [{ user_id: A }]
      const { out } = await call(route, method, { 'cookie-mumate-id': A })
      expectServed(out)
    })

    it('sealed fallback: no session, A\'s cookie and A\'s seal ⇒ served as A (#391 browsers keep working)', async () => {
      h.state.providerRows = [{ user_id: A }]
      const { out } = await call(route, method, { 'cookie-mumate-id': A, [SEAL]: sealFor(A) })
      expectServed(out)
    })
  },
)
