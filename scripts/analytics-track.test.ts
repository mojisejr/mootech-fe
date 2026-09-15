// CIEL mootech-ga4-instrumentation-001 — teeth on the one door analytics walks through (lib/analytics).
//
// WHAT THIS PROVES. ① an event not on the list never reaches the dataLayer; ② a parameter key that looks
// like identity or birth data is refused even when someone adds it to the list; ③ a member who turned the
// PDPA analytics switch off sends nothing; ④ the keyed user_id exists only with a key and is never the raw
// id; ⑤ no file on the payment lane imports lib/analytics — the CSP there (#493) is the real wall, this is
// the tripwire that says someone tried to climb it.
//
// MUTANTS RUN 2026-09-15 (each restored after):
//   drop the FORBIDDEN_PARAM_KEY test in validateEvent → ② reddens ("birth_date" accepted)
//   drop the analyticsAllowed() call in track()        → ③ reddens (push happens with mumate-ca=0)
//   return memberId when the key is unset             → ④ reddens (raw id in the output)
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { ANALYTICS_EVENTS, FORBIDDEN_PARAM_KEY } from '../lib/analytics/events'
import { track, validateEvent } from '../lib/analytics/track'
import { analyticsAllowed, readAnalyticsConsentCookie, ANALYTICS_CONSENT_COOKIE, ANALYTICS_STORAGE_DEFAULT } from '../lib/analytics/consent'
import { analyticsUserId } from '../lib/analytics/identity'

type DL = Window & { dataLayer?: unknown[] }

function clearCookie(name: string) {
  document.cookie = `${name}=; Path=/; Max-Age=0`
}

describe('① allowlist — only listed events, only listed keys', () => {
  it('every declared key is itself clean of the forbidden pattern (the list cannot smuggle one in)', () => {
    for (const [name, keys] of Object.entries(ANALYTICS_EVENTS)) {
      for (const k of keys) expect(FORBIDDEN_PARAM_KEY.test(k), `${name}.${k}`).toBe(false)
    }
  })
  it('refuses an unlisted event', () => {
    expect(validateEvent('page_scroll_depth', {})).toBe('rejected-event')
  })
  it('refuses a key the event did not declare', () => {
    expect(validateEvent('login', { source: 'x' })).toBe('rejected-key')
  })
  it('accepts a listed event with its listed keys', () => {
    expect(validateEvent('login', { method: 'line' })).toBeNull()
    expect(validateEvent('sign_up', { method: 'google' })).toBeNull()
    expect(validateEvent('consent_update', { analytics: false })).toBeNull()
  })
  it('refuses structured values and long strings', () => {
    expect(validateEvent('login', { method: { a: 1 } as unknown as string })).toBe('rejected-value')
    expect(validateEvent('login', { method: 'x'.repeat(101) })).toBe('rejected-value')
  })
})

describe('② forbidden keys — identity and birth data never travel', () => {
  const smells = ['birth_date', 'birthTime', 'dob', 'email', 'phone', 'tel', 'line_id', 'lineId', 'display_name', 'first_name', 'member_id', 'user_id', 'userId', 'uuid', 'id_token', 'zodiac', 'element', 'bazi_chart', 'client_ip']
  for (const key of smells) {
    it(`refuses "${key}" even when someone has written it into the allowlist`, () => {
      expect(FORBIDDEN_PARAM_KEY.test(key)).toBe(true)
      // The poisoned list is the point: without it "not declared" would refuse the key for the wrong
      // reason and the forbidden pattern could be deleted without this test noticing (mutant 1).
      const poisoned = { login: ['method', key] as const }
      expect(validateEvent('login', { [key]: 'x' }, poisoned)).toBe('rejected-key')
    })
  }
})

describe('③ consent — the PDPA switch governs the push', () => {
  beforeEach(() => {
    ;(window as DL).dataLayer = []
    clearCookie(ANALYTICS_CONSENT_COOKIE)
  })
  afterEach(() => clearCookie(ANALYTICS_CONSENT_COOKIE))

  it('the app model is opt-out: no stored choice follows ANALYTICS_STORAGE_DEFAULT', () => {
    expect(readAnalyticsConsentCookie('')).toBeNull()
    expect(analyticsAllowed('')).toBe(ANALYTICS_STORAGE_DEFAULT === 'granted')
  })
  it('mumate-ca=0 blocks the push and nothing lands in the dataLayer', () => {
    document.cookie = `${ANALYTICS_CONSENT_COOKIE}=0; Path=/`
    expect(track('login', { method: 'line' })).toBe('blocked-consent')
    expect((window as DL).dataLayer).toEqual([])
  })
  it('mumate-ca=1 pushes the event with exactly the declared keys', () => {
    document.cookie = `${ANALYTICS_CONSENT_COOKIE}=1; Path=/`
    expect(track('login', { method: 'line' })).toBe('pushed')
    expect((window as DL).dataLayer).toEqual([{ event: 'login', method: 'line' }])
  })
  it('a refused event never reaches the dataLayer even with consent', () => {
    document.cookie = `${ANALYTICS_CONSENT_COOKIE}=1; Path=/`
    expect(track('login' as never, { birth_date: '1990-01-01' } as never)).toBe('rejected-key')
    expect((window as DL).dataLayer).toEqual([])
  })
})

describe('④ identity — keyed hash or nothing', () => {
  const member = '4d0f2c5e-1b7a-4c1e-9f1e-0b7a3c2d1e5f'
  it('is null without a key, and null with a key too short to mean anything', () => {
    expect(analyticsUserId(member, undefined)).toBeNull()
    expect(analyticsUserId(member, '')).toBeNull()
    expect(analyticsUserId(member, 'short')).toBeNull()
  })
  it('is deterministic per key, 32 hex chars, and never contains the member id', () => {
    const a = analyticsUserId(member, 'k'.repeat(32))
    const b = analyticsUserId(member, 'k'.repeat(32))
    expect(a).toBe(b)
    expect(a).toMatch(/^[0-9a-f]{32}$/)
    expect(a).not.toContain(member.slice(0, 8))
  })
  it('changes with the key (a rotated key is a new population, as .env.example warns)', () => {
    expect(analyticsUserId(member, 'k'.repeat(32))).not.toBe(analyticsUserId(member, 'j'.repeat(32)))
  })
  it('is null for an empty member id', () => {
    expect(analyticsUserId('', 'k'.repeat(32))).toBeNull()
  })
})

describe('⑤ payment lane — nothing under the CSP imports lib/analytics', () => {
  const roots = ['features/v2-shop', 'pages/v2/shop', 'pages/api/v2/payment', 'lib/payment']
  function walk(dir: string, out: string[] = []): string[] {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name)
      if (statSync(p).isDirectory()) walk(p, out)
      else if (/\.(ts|tsx)$/.test(name)) out.push(p)
    }
    return out
  }
  it('no file on the lane mentions lib/analytics', () => {
    const offenders: string[] = []
    for (const root of roots) {
      for (const file of walk(join(process.cwd(), root))) {
        if (/lib\/analytics/.test(readFileSync(file, 'utf8'))) offenders.push(file)
      }
    }
    expect(offenders).toEqual([])
  })
})
