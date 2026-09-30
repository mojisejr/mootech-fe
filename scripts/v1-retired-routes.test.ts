// CIEL mumate-be-retirement-001 slice 2a, DoD V1 — every former v1 route answers a redirect to its v2 target,
// and no v1 page renders. The rule is lib/v1-retired-routes.ts, applied by middleware.ts.
//
// Two halves, and the second is the one with teeth against drift:
//   ① the route table, route by route, through the REAL middleware: status, target, no-store, query kept.
//   ② every page file under pages/ is either redirected (to a v2 page that exists) or on the KEPT list below
//      with a reason. A new v1-looking page that is in neither fails here, so "every v1 route" cannot quietly
//      stop being true.
//
// MUTANTS (each reddens this file):
//   M1  delete a row from RETIRED_V1_ROUTES                       → ① names the path, ② names the page
//   M2  point a row at a v2 page that does not exist             → ② "target is a real v2 page"
//   M3  call redirectRetiredV1 before the maintenance gate       → ③ "maintenance still wins"
//   M4  use 308                                                   → ① status
//   M5  let `/login` match `/login-with…`-style look-alikes by dropping the `/` boundary → ④
import { describe, it, expect, beforeEach } from 'vitest'
import { readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { NextRequest } from 'next/server'
import { middleware } from '../middleware'
import { RETIRED_V1_ROUTES, retiredV1Target } from '../lib/v1-retired-routes'
import { resolveCompatibilityKind } from '../features/v2-service/compatibility'

function resetEnv() {
  delete process.env.MAINTENANCE_MODE
  delete process.env.MAINTENANCE_BYPASS_KEY
  delete process.env.V2_PREVIEW_KEY
  delete process.env.WHATIF_KEY
  delete process.env.OPS_DASHBOARD_KEY
  delete process.env.GLASS_BOX_KEY
  delete process.env.LAUNCH_KEY
}

function mkReq(path: string, cookie?: string) {
  const headers = new Headers()
  if (cookie) headers.set('cookie', cookie)
  return new NextRequest(new URL('http://localhost' + path), { headers })
}

const location = (res: Response) => res.headers.get('location')
const rewrite = (res: Response) => res.headers.get('x-middleware-rewrite')

// ① The table the PR body carries. A dynamic segment is probed with a sample value.
const ROUTE_TABLE: Array<[string, string]> = [
  ['/', '/v2'],
  ['/calculator', '/v2/element-finder'],
  ['/chinese-calendar', '/v2/calendar'],
  ['/fortune-stick', '/v2/fortune/sage'],
  ['/friend/7f1c2a9e', '/v2/service/compatibility/love'],
  ['/friend/7f1c2a9e/edit', '/v2/service/compatibility/love'],
  ['/login', '/v2/login'],
  ['/login-with', '/v2/login'],
  ['/matching', '/v2/service/compatibility/love'],
  ['/matching/recent', '/v2/service/compatibility/recent'],
  ['/matching/result', '/v2/service/compatibility/recent'],
  ['/my-destiny', '/v2/destiny'],
  ['/package-horoscope', '/v2/shop'],
  ['/package-price', '/v2/shop'],
  ['/payment', '/v2'],
  ['/payment/callback', '/v2'],
  ['/payment/creditcard', '/v2'],
  ['/payment/failure', '/v2'],
  ['/payment/qrcode/scan', '/v2'],
  ['/payment/thankyou', '/v2'],
  ['/profile', '/v2/settings'],
  ['/profile/activity', '/v2/settings'],
  ['/profile/edit', '/v2/settings/edit-profile'],
  ['/profile/how-to-earn', '/v2/qi/missions'],
  ['/register', '/v2/register'],
  ['/share/image/ABC123', '/v2'],
  ['/share/profile/ABC123', '/v2'],
  ['/share/type/ABC123', '/v2'],
  ['/survey', '/v2'],
  ['/welcome', '/v2'],
]

describe('① every v1 route redirects to its v2 target (maintenance off)', () => {
  beforeEach(resetEnv)

  it.each(ROUTE_TABLE)('%s → %s', (from, to) => {
    const res = middleware(mkReq(from))
    expect(res.status).toBe(307)
    expect(location(res)).toBe(`http://localhost${to}`)
    expect(rewrite(res)).toBeNull()
    expect(res.headers.get('cache-control')).toContain('no-store')
  })

  it('keeps the query string (a referral code on an old /register link still arrives)', () => {
    expect(location(middleware(mkReq('/register?ref=MUMATE123&utm_source=line')))).toBe(
      'http://localhost/v2/register?ref=MUMATE123&utm_source=line',
    )
  })

  it('the baseline security headers still ride on the redirect', () => {
    expect(middleware(mkReq('/my-destiny')).headers.get('x-content-type-options')).toBe('nosniff')
  })
})

// ② Every page file, classified. KEPT is the list of pages under pages/ that are NOT v1, with the reason.
const KEPT: Record<string, string> = {
  '/v2': 'the app',
  '/auth': 'NextAuth landing (/auth/after/[provider], used by useV2Login) and error page',
  '/invite': 'v2 referral link',
  '/p': 'public share page of a v2 sacred-map place',
  '/privacy': 'legal pages linked from v2',
  '/maintenance': "the maintenance gate's own page",
  '/ops': 'internal console, own key',
  '/launch': 'internal console, own key',
  '/glass-box': 'internal console, own key',
  '/what-if': 'campaign, own key',
  '/promo': 'v2 promo landing pages (MUMATE100 free month, 2026-09-28)',
  '/pwa-check': 'team diagnostic, behind the v2 preview check',
  '/design-system': 'team design reference, no BE',
  '/dev-login': 'dev-only (refuses in production)',
  '/dev-access': 'dev visual harnesses, no BE',
}
const isKept = (route: string) =>
  Object.keys(KEPT).some((k) => route === k || route.startsWith(`${k}/`))

function pageFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name)
    if (e.isDirectory()) return p === join('pages', 'api') ? [] : pageFiles(p)
    return /\.(tsx|ts|jsx|js)$/.test(e.name) ? [p] : []
  })
}

const INFRA = /^pages\/_(app|document|error)\.|^pages\/(404|500)\./
const routeOf = (file: string) => {
  const r = '/' + file.replace(/^pages\//, '').replace(/\.(tsx|ts|jsx|js)$/, '').replace(/(^|\/)index$/, '')
  return (r === '/' ? '/' : r.replace(/\/$/, '')).replace(/\[\.{0,3}([^\]]+)\]/g, 'sample-$1')
}
// Resolves a concrete path the way the Pages Router does: an exact segment first, else a `[param]` sibling.
function pageExists(route: string): boolean {
  let dir = 'pages'
  const segs = route.split('/').filter(Boolean)
  for (let i = 0; i < segs.length; i++) {
    const last = i === segs.length - 1
    const names = existsSync(dir) ? readdirSync(dir) : []
    const fileHit = (n: string) => last && ['.tsx', '.ts'].some((x) => names.includes(n + x))
    if (fileHit(segs[i])) return true
    if (names.includes(segs[i])) { dir = join(dir, segs[i]); continue }
    const dyn = names.find((n) => /^\[[^.\]]+\](\.tsx?)?$/.test(n))
    if (!dyn) return false
    if (/\.tsx?$/.test(dyn)) return last
    dir = join(dir, dyn)
  }
  return ['.tsx', '.ts'].some((x) => existsSync(join(dir, 'index' + x)))
}

const pages = pageFiles('pages').filter((f) => !INFRA.test(f))

describe('② every page under pages/ is either redirected or kept on purpose', () => {
  beforeEach(resetEnv)

  it('the walk found the tree (a zero here is not a pass)', () => {
    expect(pages.length).toBeGreaterThan(100)
    expect(pages.filter((f) => !isKept(routeOf(f))).length).toBeGreaterThan(25)
  })

  it.each(pages.map((f) => [f, routeOf(f)]))('%s', (_file, route) => {
    if (isKept(route)) {
      expect(retiredV1Target(route), `${route} is kept but a retirement row matches it`).toBeNull()
      return
    }
    const target = retiredV1Target(route)
    expect(target, `${route} is neither on the KEPT list nor redirected`).not.toBeNull()
    expect(target!.startsWith('/v2'), `${route} → ${target} is not a v2 page`).toBe(true)
    expect(pageExists(target!), `${route} → ${target}, which has no page file`).toBe(true)
    const res = middleware(mkReq(route))
    expect(res.status).toBe(307)
    expect(location(res)).toBe(`http://localhost${target}`)
  })

  it('every row of the table names a v1 page that exists (no dead rows)', () => {
    for (const row of RETIRED_V1_ROUTES) {
      const hit = pages.some((f) => {
        const r = routeOf(f)
        return row.from === '/' ? r === '/' : r === row.from || r.startsWith(`${row.from}/`)
      })
      expect(hit, `row ${row.from} matches no page`).toBe(true)
      expect(pageExists(row.to), `row ${row.from} → ${row.to}, which has no page file`).toBe(true)
    }
  })

  it('the compatibility target is a kind the [kind] page accepts (else it bounces to /v2/service)', () => {
    const kinds = RETIRED_V1_ROUTES.map((r) => r.to.match(/^\/v2\/service\/compatibility\/([^/]+)$/)?.[1])
      .filter((k): k is string => !!k && k !== 'recent')
    expect(kinds.length).toBeGreaterThan(0)
    for (const k of kinds) expect(resolveCompatibilityKind(k), k).not.toBeNull()
  })
})

describe('③ maintenance stays the outermost gate', () => {
  beforeEach(resetEnv)

  it('maintenance on, no bypass: a v1 URL gets the maintenance page, not a redirect', () => {
    process.env.MAINTENANCE_MODE = 'on'
    process.env.MAINTENANCE_BYPASS_KEY = 'k'
    const res = middleware(mkReq('/my-destiny'))
    expect(location(res)).toBeNull()
    expect(rewrite(res) ?? '').toContain('/maintenance')
  })

  it('maintenance on, valid bypass cookie: the v1 URL is retired like any other request that reaches the app', () => {
    process.env.MAINTENANCE_MODE = 'on'
    process.env.MAINTENANCE_BYPASS_KEY = 'k'
    const res = middleware(mkReq('/my-destiny', 'mnt_bypass=k'))
    expect(res.status).toBe(307)
    expect(location(res)).toBe('http://localhost/v2/destiny')
  })
})

describe('④ nothing that is not v1 is touched', () => {
  beforeEach(resetEnv)

  it.each([
    '/v2',
    '/v2/register',
    '/v2/login',
    '/v2/welcome-back',
    '/auth/after/line',
    '/auth/error',
    '/invite/MUMATE123',
    '/privacy/policy',
    '/p/some-place',
    '/api/profile',
    '/api/user',
    '/api/auth/session',
    '/api/chat/balance',
    '/profiles',
    '/login-withx',
    '/payments',
    '/registered',
    '/share-card',
  ])('%s passes through', (path) => {
    expect(retiredV1Target(path)).toBeNull()
    const res = middleware(mkReq(path))
    expect(location(res)).toBeNull()
    expect(rewrite(res)).toBeNull()
  })
})
