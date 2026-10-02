// mumate-member-identity-hardening-001 slice 1 step 2b — routes where the CLIENT named the user_id.
//
// /api/user, the friend list / detail / delete took the member from ?user_id= (or a friend row id) with no
// identity at all. They now serve only the signed caller: another member's id in the query is the 409
// `reason: 'identity'` clients already handle, and a friend row is found only among the caller's own.
// v1-only routes whose every caller sits behind a retired v1 page answer 410 and touch nothing.
//
// Only the transport is mocked (session, db, fetch); each handler runs for real. The property is about
// what leaves the handler: another member's id never reaches a query, a bazi call, or the response.
import { describe, it, expect, vi, beforeEach } from 'vitest'

const A = '11111111-2222-4333-8444-555555555555' // the caller
const OTHER = '99999999-8888-4777-8666-555555555555' // someone else

const h = vi.hoisted(() => {
  const state = {
    session: null as null | { providerId: string; provider: string },
    providerRows: [] as Array<{ user_id: string }>,
    selectQueue: [] as unknown[][], // one entry per db.select() call, in order
    deleteRows: [] as unknown[],
  }
  const outbound: string[] = []
  const deepText = (v: unknown): string => {
    const seen = new WeakSet()
    try {
      return (
        JSON.stringify(v, (_k, x) => {
          if (typeof x === 'object' && x !== null) {
            if (seen.has(x)) return undefined
            seen.add(x)
          }
          return typeof x === 'bigint' ? String(x) : x
        }) ?? String(v)
      )
    } catch {
      return String(v)
    }
  }
  // drizzle's builder: every call records its arguments and returns the chain; awaiting it yields rows.
  const chain = (rows: () => unknown[]): unknown => {
    const p: unknown = new Proxy(function () {}, {
      get(_t, k) {
        if (k === 'then') return (ok: (v: unknown) => unknown, ko: (e: unknown) => unknown) => Promise.resolve(rows()).then(ok, ko)
        return (...args: unknown[]) => {
          for (const a of args) outbound.push(`db:${deepText(a)}`)
          return p
        }
      },
    })
    return p
  }
  const db = {
    execute: vi.fn(async (q: unknown) => {
      const text = deepText(q)
      outbound.push(`db:${text}`)
      if (text.includes('FROM user_provider')) return state.providerRows
      if (text.includes('FROM \\"user\\"')) {
        const id = state.providerRows[0]?.user_id
        return id && text.includes(id) ? [{ user_id: id, name: 'n' }] : [] // a row only for the id actually queried
      }
      return [{ n: 0 }]
    }),
    select: vi.fn(() => {
      const rows = state.selectQueue.shift() ?? []
      return chain(() => rows)
    }),
    delete: vi.fn(() => chain(() => state.deleteRows)),
  }
  return { state, outbound, deepText, db, getServerSession: vi.fn(async () => state.session) }
})

vi.mock('next-auth/next', () => ({ getServerSession: h.getServerSession }))
vi.mock('@/pages/api/auth/[...nextauth]', () => ({ authOptions: {}, default: () => undefined }))
vi.mock('@/lib/db', () => ({ db: h.db }))
vi.mock('@/lib/usage', async (orig) => ({
  ...(await orig<typeof import('@/lib/usage')>()),
  checkMemberWithFriendUsage: async () => ({ code: 'SUCCESS' }),
}))

process.env.NEXTAUTH_SECRET = 'member-routes-userid-secret'
process.env.BAZI_BASE_URL = 'http://bazi.test'

async function call(path: string, method: string, opts: { query?: Record<string, string>; body?: unknown; cookies?: Record<string, string> } = {}) {
  const mod = (await import(`@/${path}`)) as { default: (req: unknown, res: unknown) => unknown }
  const out = { status: 200, body: undefined as unknown, headers: {} as Record<string, unknown> }
  const res: Record<string, unknown> = {}
  Object.assign(res, {
    status(c: number) {
      out.status = c
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
    end() {
      return res
    },
    setHeader(n: string, v: unknown) {
      out.headers[n.toLowerCase()] = v
      return res
    },
    getHeader: (n: string) => out.headers[n.toLowerCase()],
  })
  await mod.default(
    { method, query: opts.query ?? {}, body: opts.body ?? {}, cookies: opts.cookies ?? {}, headers: {} },
    res,
  )
  return { out, leaked: () => h.outbound.some((s) => s.includes(OTHER)) || h.deepText(out.body).includes(OTHER) }
}

const signInAsA = () => {
  h.state.session = { providerId: 'U-A', provider: 'line' }
  h.state.providerRows = [{ user_id: A }]
}

const fetchMock = vi.fn(async (url: unknown, init?: { body?: unknown }) => {
  h.outbound.push(`fetch:${String(url)} ${typeof init?.body === 'string' ? init.body : ''}`)
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'content-type': 'application/json' } })
})

beforeEach(() => {
  h.state.session = null
  h.state.providerRows = []
  h.state.selectQueue = []
  h.state.deleteRows = []
  h.outbound.length = 0
  h.db.execute.mockClear()
  h.db.select.mockClear()
  h.db.delete.mockClear()
  fetchMock.mockClear()
  vi.stubGlobal('fetch', fetchMock)
})

const MEMBER_USER_ROW = { userId: OTHER, name: 'friend', surname: '', pictureUrl: '', createAt: null, updateAt: null, dob: '1991-02-02', time: '11:00', isRememberTime: true, gender: 'female', placeName: '' }

const FRIEND_ROW = (memberId: string) => ({
  id: 'f-1',
  userId: A,
  name: 'local',
  surname: '',
  pictureUrl: '',
  createAt: null,
  updateAt: null,
  dob: '1990-01-01',
  time: '10:00',
  isRememberTime: true,
  gender: 'male',
  placeName: '',
  isMember: memberId !== '',
  memberId,
})

describe('GET /api/user — only the caller\'s own row', () => {
  it('no session, someone else\'s id in the query and cookie ⇒ 401, nothing about them is read', async () => {
    const { out, leaked } = await call('pages/api/user', 'GET', { query: { user_id: OTHER }, cookies: { 'cookie-mumate-id': OTHER } })
    expect(out.status).toBe(401)
    expect(leaked()).toBe(false)
  })

  it('signed in as A asking for another member ⇒ 409 identity, nothing read', async () => {
    signInAsA()
    const { out, leaked } = await call('pages/api/user', 'GET', { query: { user_id: OTHER } })
    expect(out.status).toBe(409)
    expect((out.body as { reason?: string }).reason).toBe('identity')
    expect(leaked()).toBe(false)
  })

  it('signed in as A asking for A (any case) ⇒ A\'s row; with no query ⇒ A\'s row', async () => {
    signInAsA()
    // 'undefined' is what an old client bug really sent (lib/auth/use-current-user.ts); it is not an identity
    for (const query of [{ user_id: A }, { user_id: A.toUpperCase() }, { user_id: 'undefined' }, {} as Record<string, string>]) {
      const { out } = await call('pages/api/user', 'GET', { query, cookies: { 'cookie-mumate-id': A } })
      expect(out.status).toBe(200)
      expect((out.body as { user_id?: string }).user_id).toBe(A)
    }
  })
})

describe('/api/member-with-friend — the caller\'s own friends', () => {
  it('GET: no session ⇒ 401 and no list is read', async () => {
    const { out, leaked } = await call('pages/api/member-with-friend/index', 'GET', { query: { user_id: OTHER }, cookies: { 'cookie-mumate-id': OTHER } })
    expect(out.status).toBe(401)
    expect(h.db.select).not.toHaveBeenCalled()
    expect(leaked()).toBe(false)
  })

  it('GET: signed in as A asking for another member\'s list ⇒ 409 identity', async () => {
    signInAsA()
    const { out, leaked } = await call('pages/api/member-with-friend/index', 'GET', { query: { user_id: OTHER } })
    expect(out.status).toBe(409)
    expect(leaked()).toBe(false)
  })

  it('GET: A\'s own list is served, and a friend who is a member does not expose their user_id', async () => {
    signInAsA()
    h.state.selectQueue = [[FRIEND_ROW(OTHER)], [MEMBER_USER_ROW]]
    const { out } = await call('pages/api/member-with-friend/index', 'GET', { query: { user_id: A }, cookies: { 'cookie-mumate-id': A } })
    expect(out.status).toBe(200)
    expect(Array.isArray(out.body)).toBe(true)
    const list = out.body as Array<{ member_id: string; is_member: boolean }>
    expect(list).toHaveLength(1)
    expect(list[0].is_member).toBe(true)
    expect(list[0].member_id).not.toBe('') // the v1 friend page tells member from non-member by this
    expect(h.deepText(out.body)).not.toContain(OTHER)
  })

  it('DELETE: no session ⇒ 401, nothing deleted; another member\'s id ⇒ 409; own ⇒ scoped to A', async () => {
    let r = await call('pages/api/member-with-friend/index', 'DELETE', { query: { user_id: OTHER, id: 'f-1' } })
    expect(r.out.status).toBe(401)
    expect(h.db.delete).not.toHaveBeenCalled()

    signInAsA()
    r = await call('pages/api/member-with-friend/index', 'DELETE', { query: { user_id: OTHER, id: 'f-1' } })
    expect(r.out.status).toBe(409)
    expect(h.db.delete).not.toHaveBeenCalled()

    for (const asked of [A, 'undefined']) {
      h.outbound.length = 0
      h.state.deleteRows = [{ id: 'f-1' }]
      r = await call('pages/api/member-with-friend/index', 'DELETE', { query: { user_id: asked, id: 'f-1' }, cookies: { 'cookie-mumate-id': A } })
      expect(r.out.status).toBe(200)
      expect(h.outbound.some((s) => s.includes('f-1') && s.includes(A))).toBe(true) // the delete is scoped to A
    }
  })

  it('detail: no session ⇒ 401 and no row is read', async () => {
    const { out } = await call('pages/api/member-with-friend/detail', 'GET', { query: { id: 'f-1' } })
    expect(out.status).toBe(401)
    expect(h.db.select).not.toHaveBeenCalled()
  })

  it('detail: the lookup is scoped to the caller, and a member friend does not expose their user_id', async () => {
    signInAsA()
    h.state.selectQueue = [[FRIEND_ROW(OTHER)], [MEMBER_USER_ROW]]
    const { out } = await call('pages/api/member-with-friend/detail', 'GET', { query: { id: 'f-1' }, cookies: { 'cookie-mumate-id': A } })
    expect(out.status).toBe(200)
    // the friend-row lookup names the caller (first select's where clause)
    const firstSelect = h.outbound.find((s) => s.includes('f-1'))
    expect(firstSelect).toContain(A)
    expect(h.deepText(out.body)).not.toContain(OTHER)
    expect((out.body as { member_id: string }).member_id).not.toBe('')
  })

  it('detail: a cookie naming someone else ⇒ 409 identity', async () => {
    signInAsA()
    const { out } = await call('pages/api/member-with-friend/detail', 'GET', { query: { id: 'f-1' }, cookies: { 'cookie-mumate-id': OTHER } })
    expect(out.status).toBe(409)
  })
})

describe('v1-only routes answer 410 and touch nothing', () => {
  for (const [path, method] of [
    ['pages/api/quota/index', 'GET'],
    ['pages/api/log-activity', 'GET'],
    ['pages/api/log-survey', 'GET'],
    ['pages/api/log-save-image', 'POST'],
    ['pages/api/chinese-calendar/diary', 'GET'],
    ['pages/api/chinese-calendar/month', 'GET'],
  ] as const) {
    it(`${method} ${path.replace('pages', '')}`, async () => {
      signInAsA()
      const { out, leaked } = await call(path, method, { query: { user_id: OTHER }, body: { user_id: OTHER } })
      expect(out.status).toBe(410)
      expect(h.db.execute).not.toHaveBeenCalled()
      expect(h.db.select).not.toHaveBeenCalled()
      expect(fetchMock).not.toHaveBeenCalled()
      expect(leaked()).toBe(false)
    })
  }
})

describe('POST /api/home-fortune — the engine is told the caller, not the body\'s anonId', () => {
  it('a body anonId naming someone else never reaches the engine', async () => {
    signInAsA()
    const { leaked } = await call('pages/api/home-fortune', 'POST', {
      body: { anonId: OTHER, person: { dob: '1990-01-01', time: '10:00', gender: 'male', name: 'n' } },
      cookies: { 'cookie-mumate-id': A },
    })
    expect(fetchMock).toHaveBeenCalled()
    expect(leaked()).toBe(false)
  })
})
