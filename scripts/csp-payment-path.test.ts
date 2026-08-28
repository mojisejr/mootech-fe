// #493 — the payment lane carries a Content-Security-Policy, and nothing else does.
//
// WHY THIS FILE EXISTS. We keep our own card inputs instead of Omise's iframe (#446), so a script that
// runs on the checkout screen can read the card number out of the DOM. The CSP is the browser-enforced
// list of what those screens may load and talk to.
//
// 🔴 WHAT THIS FILE PROVES AND WHAT IT DOES NOT.
//   PROVES  the middleware emits the header on the payment paths, does NOT emit it anywhere else, and
//           that the header's value still contains the two clauses the ticket's decisions rest on:
//           no 'unsafe-inline' in script-src (which is what shuts Google Tag Manager out) and no
//           googletagmanager host anywhere in it.
//   DOES NOT that a browser OBEYS it. A header can be perfectly formed and enforce nothing — a CSP set
//           in report-only mode looks exactly like success from here. That tooth is in
//           e2e/v2-csp-teeth.spec.ts, which loads an off-list script in a real Chromium and asserts it
//           is refused. Do not read a green here as "the lane is protected".
//
// MUTANTS RUN, not imagined (2026-08-28, both restored after):
//   1. delete the `withPaymentLaneCsp(...)` call at the guardV2 call site → 12 failed | 9 passed.
//      The 9 survivors are the absence-assertions further down; that is expected and is why they
//      carry their own warning.
//   2. widen script-src with 'unsafe-inline' → 1 failed | 20 passed, and the one that died is
//      "script-src has no unsafe-inline", i.e. it died for the reason it claims to guard.
import { describe, it, expect, beforeAll } from 'vitest'

// The middleware reads these at call time; set them before it is imported so the v2 surface is
// configured (an unconfigured key fails closed and rewrites everything to /maintenance).
process.env.V2_PREVIEW_KEY = 'testkey'
process.env.MAINTENANCE_MODE = 'off'

let NextRequest: typeof import('next/server').NextRequest
let middleware: typeof import('../middleware').middleware

beforeAll(async () => {
  ;({ NextRequest } = await import('next/server'))
  ;({ middleware } = await import('../middleware'))
})

/** `authed` decides which of guardV2's seven exits the request leaves through. */
function csp(path: string, authed = true): string | null {
  const headers = new Headers()
  if (authed) headers.set('cookie', 'v2_access=testkey')
  const res = middleware(new NextRequest(new URL(`http://localhost${path}`), { headers }))
  return res?.headers.get('content-security-policy') ?? null
}

const PAYMENT_PATHS = ['/v2/shop/checkout', '/v2/shop/qrcode', '/v2/shop/result']

describe('#493 the payment lane carries a CSP', () => {
  it.each(PAYMENT_PATHS)('%s carries the header', (p) => {
    expect(csp(p)).toBeTruthy()
  })

  it.each(PAYMENT_PATHS)('%s carries it on the UNAUTHENTICATED exit too', (p) => {
    // guardV2 rewrites to /maintenance without a cookie and still answers 200. The header is keyed on
    // the request path, so every exit of that function is covered, not just the happy one.
    expect(csp(p, false)).toBeTruthy()
  })

  it('a query string does not change the verdict', () => {
    expect(csp('/v2/shop/checkout?package_code=V2_PRO_YEARLY')).toBeTruthy()
  })

  it('it does not break the Cache-Control the lane already had', () => {
    const headers = new Headers({ cookie: 'v2_access=testkey' })
    const res = middleware(new NextRequest(new URL('http://localhost/v2/shop/checkout'), { headers }))
    expect(res?.headers.get('cache-control')).toBe('no-store, must-revalidate')
  })
})

// ⚠️ Every case in this block asserts an ABSENCE, so all nine stay green if the CSP disappears
// entirely — measured: mutant 1 below turns 12 cases red and leaves these 9 green. They are the
// scope guard, never the presence guard. Read them together with the block above, never alone.
describe('#493 nothing outside the payment lane is touched', () => {
  // /v2/shop is the package LIST — no card fields, and deliberately outside this ticket's scope.
  it.each(['/v2', '/v2/shop', '/v2/account', '/v2/calendar', '/api/v2/payment/charge', '/api/v2/login'])(
    '%s carries no CSP',
    (p) => {
      expect(csp(p)).toBeNull()
    },
  )

  it('v1 is untouched', () => {
    expect(csp('/payment/qrcode/scan', false)).toBeNull()
    expect(csp('/', false)).toBeNull()
  })

  it('a path that merely starts with the same letters is not the lane', () => {
    // Guards against a `startsWith('/v2/shop/checkout')` that would also match a sibling route.
    expect(csp('/v2/shop/checkout-preview')).toBeNull()
  })
})

describe('#493 the header still says what the decisions rest on', () => {
  const header = () => csp('/v2/shop/checkout') as string

  it('script-src has no unsafe-inline — this is what blocks the GTM loader', () => {
    const scriptSrc = header()
      .split(';')
      .map((d) => d.trim())
      .find((d) => d.startsWith('script-src'))
    expect(scriptSrc).toBeDefined()
    expect(scriptSrc).not.toContain('unsafe-inline')
  })

  it('no tag-manager host appears anywhere in the policy', () => {
    // Feem decided 2026-08-28: GTM stays on every other screen and is shut out of the payment lane,
    // because it injects arbitrary JavaScript with no PR, no review and no deploy.
    expect(header()).not.toContain('googletagmanager')
  })

  it('frames are refused, which is what stops the GTM noscript iframe', () => {
    expect(header()).toContain("frame-src 'none'")
  })

  it('the two Omise origins the lane genuinely needs are allowed', () => {
    // cdn.omise.co serves omise.js; api.omise.co takes the token request and serves the PromptPay QR.
    expect(header()).toContain('https://cdn.omise.co')
    expect(header()).toContain('https://api.omise.co')
  })

  it('🔴 unsafe-eval is NOT in the policy outside development', () => {
    // `next dev` needs it (it evaluates strings for HMR) and production does not — measured against a
    // real build. vitest runs with NODE_ENV=test, so this asserts the shape production actually gets.
    // If this ever goes green while production is broken, the condition in middleware.ts widened from
    // "development" to "not production".
    expect(process.env.NODE_ENV).not.toBe('development')
    expect(header()).not.toContain('unsafe-eval')
  })

  it('the font origins the stylesheets pull in are allowed', () => {
    // styles/globals.css:1-6 @imports six sheets from fonts.googleapis.com, which then fetch files from
    // fonts.gstatic.com. Neither is visible in the served HTML; both were found in a browser.
    expect(header()).toContain('https://fonts.googleapis.com')
    expect(header()).toContain('https://fonts.gstatic.com')
  })

  it('the fallback is closed, so a directive we forgot does not default to open', () => {
    expect(header()).toContain("default-src 'self'")
    expect(header()).toContain("object-src 'none'")
  })
})
