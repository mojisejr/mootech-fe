// mumate-member-identity-hardening-001 slice 1 step 3 — every FE → bazi call carries the client secret.
//
// bazi's member routes take the member from an anonId in the request; they will answer only callers that
// hold BAZI_CLIENT_ID_SECRET, which is the FE server. baziFetch is the one place that adds it, and the
// guard below keeps every FE file that talks to bazi on it.
//
// 🔴 MUTANT CONTRACT:
//   B1  baziFetch stops adding the secret                     → the header test reddens
//   B2  it drops headers the caller set                       → the merge test reddens
//   B3  a file that calls bazi goes back to a bare fetch(     → the guard reddens, naming the file
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { baziFetch, withBaziSecret } from '@/lib/bazi/fetch'

const SECRET = 's'.repeat(43)

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('withBaziSecret', () => {
  it('B1 — adds x-mumate-client-secret when the secret is set', () => {
    expect(withBaziSecret(undefined, { BAZI_CLIENT_ID_SECRET: SECRET }).headers).toEqual({ 'x-mumate-client-secret': SECRET })
  })

  it('B2 — keeps the caller\'s headers and init (plain object or Headers)', () => {
    const plain = withBaziSecret({ method: 'POST', headers: { 'Content-Type': 'application/json' } }, { BAZI_CLIENT_ID_SECRET: SECRET })
    expect(plain.method).toBe('POST')
    expect(plain.headers).toEqual({ 'Content-Type': 'application/json', 'x-mumate-client-secret': SECRET })
    const h = withBaziSecret({ headers: new Headers({ Accept: 'image/png' }) }, { BAZI_CLIENT_ID_SECRET: SECRET }).headers as Headers
    expect(h.get('accept')).toBe('image/png')
    expect(h.get('x-mumate-client-secret')).toBe(SECRET)
    const tuples = withBaziSecret({ headers: [['Accept', 'x']] }, { BAZI_CLIENT_ID_SECRET: SECRET }).headers as Headers
    expect(tuples.get('accept')).toBe('x')
    expect(tuples.get('x-mumate-client-secret')).toBe(SECRET)
  })

  it('no secret set ⇒ the init is passed through untouched (Vercel today)', () => {
    const init = { method: 'GET', headers: { a: 'b' } }
    expect(withBaziSecret(init, {})).toBe(init)
    expect(withBaziSecret(init, { BAZI_CLIENT_ID_SECRET: '   ' })).toBe(init)
  })
})

describe('baziFetch', () => {
  it('calls fetch with the same URL and the secret added', async () => {
    vi.stubEnv('BAZI_CLIENT_ID_SECRET', SECRET)
    const fetchMock = vi.fn(async () => new Response('{}'))
    vi.stubGlobal('fetch', fetchMock)
    await baziFetch('http://bazi:3000/api/qi/wallet?anonId=x', { headers: { 'Content-Type': 'application/json' } })
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('http://bazi:3000/api/qi/wallet?anonId=x')
    expect(init.headers).toEqual({ 'Content-Type': 'application/json', 'x-mumate-client-secret': SECRET })
  })
})

describe('B3 — every FE file that calls bazi does it through baziFetch', () => {
  // A file that talks to bazi names BAZI_BASE_URL (or the what-if default URL). Inside such a file a bare
  // fetch( is allowed only for a call that does NOT go to bazi, listed here with its reason.
  const NOT_BAZI: Record<string, string> = {
    // fetches the mascot IMAGE at the URL bazi returns (may be a storage host) — the secret must not go there
    'pages/api/bazi-mascot.ts': 'image fetch from a URL bazi returns',
  }

  it('no bare fetch( in a bazi-calling file', () => {
    const files = execFileSync('git', ['grep', '-lE', 'BAZI_BASE_URL|BAZI_BASE\\b|BAZI_WHATIF_URL', '--', 'pages/api', 'lib'], { encoding: 'utf8' })
      .split('\n')
      .filter((f) => f && !f.endsWith('.sql') && f !== 'lib/bazi/fetch.ts')
    expect(files.length).toBeGreaterThan(40)
    const offenders = files.filter((f) => /(^|[^A-Za-z.])fetch\(/.test(readFileSync(f, 'utf8')) && !NOT_BAZI[f])
    expect(offenders).toEqual([])
  })
})
