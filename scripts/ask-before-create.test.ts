// scripts/ask-before-create.test.ts — lib/auth/ask-before-create.ts
// (mumate-login-identity-001 slice 5, plan 0.8).
//
// 🔴 MUTANT CONTRACT:
//   A1 default the switch ON → "unset / unknown value is OFF" red (owner decision 20)
//   A2 ask on 409 (ambiguous) → "ambiguous is never interrupted" red
//   A3 ask with the switch off → "switch off never asks" red (DoD D7)
//   A4 fetchIdentityStatus returns a truthy object on failure → every fail-open case red
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  CHOICE_KEY,
  decideIdentityStatus,
  fetchIdentityStatus,
  hasChosenCreateNew,
  isAskBeforeCreateEnabled,
  linkStartUrl,
  otherProvider,
  rememberCreateNew,
} from '@/lib/auth/ask-before-create'

describe('the switch (owner decision 20: default off)', () => {
  it.each(['on', 'ON', 'true', '1', 'yes', 'enabled', ' on '])('%j turns it on', (v) => {
    expect(isAskBeforeCreateEnabled(v)).toBe(true)
  })
  it.each([undefined, null, '', 'off', 'false', '0', 'no', 'maybe'])('unset / unknown value is OFF: %j', (v) => {
    expect(isAskBeforeCreateEnabled(v as string | undefined)).toBe(false)
  })
})

describe('decideIdentityStatus', () => {
  it('an unowned Google identity with the switch on → ask', () => {
    expect(decideIdentityStatus({ provider: 'google', resolved: { ok: false, status: 404 }, enabled: true })).toEqual({
      signedIn: true, known: false, ask: true, provider: 'google',
    })
  })
  it('an unowned LINE identity (any casing) with the switch on → ask', () => {
    expect(decideIdentityStatus({ provider: 'LINE', resolved: { ok: false, status: 404 }, enabled: true }).ask).toBe(true)
  })
  it('switch off never asks — today\'s behaviour (D7)', () => {
    const r = decideIdentityStatus({ provider: 'google', resolved: { ok: false, status: 404 }, enabled: false })
    expect(r.ask).toBe(false)
    expect(r.known).toBe(false)
  })
  it('a known identity is never asked (D2)', () => {
    expect(decideIdentityStatus({ provider: 'google', resolved: { ok: true }, enabled: true })).toEqual({
      signedIn: true, known: true, ask: false, provider: 'google',
    })
  })
  it('ambiguous (409) is never interrupted and is not called unowned', () => {
    expect(decideIdentityStatus({ provider: 'google', resolved: { ok: false, status: 409 }, enabled: true })).toEqual({
      signedIn: true, known: null, ask: false, provider: 'google',
    })
  })
  it('signed out → nothing to ask', () => {
    expect(decideIdentityStatus({ provider: null, resolved: null, enabled: true }).signedIn).toBe(false)
    expect(decideIdentityStatus({ provider: 'google', resolved: { ok: false, status: 401 }, enabled: true }).ask).toBe(false)
  })
  it('a provider we cannot link (dev, facebook) is never asked', () => {
    expect(decideIdentityStatus({ provider: 'dev', resolved: { ok: false, status: 404 }, enabled: true }).ask).toBe(false)
    expect(decideIdentityStatus({ provider: 'facebook', resolved: { ok: false, status: 404 }, enabled: true }).ask).toBe(false)
  })
})

describe('the "create new" choice is remembered for exactly one identity', () => {
  function memory(): Storage {
    const m = new Map<string, string>()
    return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) } as Storage
  }
  it('remembered for the identity it was made for', () => {
    const s = memory()
    rememberCreateNew(s, 'LINE', 'U123')
    expect(hasChosenCreateNew(s, 'line', 'U123')).toBe(true)
  })
  it('a different identity is still asked', () => {
    const s = memory()
    rememberCreateNew(s, 'google', '111')
    expect(hasChosenCreateNew(s, 'google', '222')).toBe(false)
    expect(hasChosenCreateNew(s, 'line', '111')).toBe(false)
  })
  it('blocked storage never throws — the question is simply asked again', () => {
    const broken = { getItem: () => { throw new Error('denied') }, setItem: () => { throw new Error('denied') } } as unknown as Storage
    expect(() => rememberCreateNew(broken, 'google', '1')).not.toThrow()
    expect(hasChosenCreateNew(broken, 'google', '1')).toBe(false)
    expect(hasChosenCreateNew(null, 'google', '1')).toBe(false)
  })
  it('uses a namespaced key', () => {
    expect(CHOICE_KEY).toBe('mumate:identity-choice')
  })
})

describe('fetchIdentityStatus fails OPEN (null = do not ask)', () => {
  afterEach(() => vi.useRealTimers())
  const ok = (body: unknown) => (async () => ({ ok: true, json: async () => body })) as unknown as typeof fetch

  it('passes a well-formed answer through', async () => {
    await expect(fetchIdentityStatus(ok({ signedIn: true, known: false, ask: true, provider: 'google' }))).resolves.toEqual({
      signedIn: true, known: false, ask: true, provider: 'google',
    })
  })
  it('non-2xx → null', async () => {
    const f = (async () => ({ ok: false, json: async () => ({ ask: true }) })) as unknown as typeof fetch
    await expect(fetchIdentityStatus(f)).resolves.toBeNull()
  })
  it('a body without a boolean ask → null', async () => {
    await expect(fetchIdentityStatus(ok({ ask: 'yes' }))).resolves.toBeNull()
    await expect(fetchIdentityStatus(ok(null))).resolves.toBeNull()
  })
  it('a network error → null', async () => {
    const f = (async () => { throw new Error('offline') }) as unknown as typeof fetch
    await expect(fetchIdentityStatus(f)).resolves.toBeNull()
  })
  it('a hang → null after the timeout, so a slow server never holds a sign-in', async () => {
    vi.useFakeTimers()
    const f = (() => new Promise(() => {})) as unknown as typeof fetch
    const p = fetchIdentityStatus(f, 4000)
    await vi.advanceTimersByTimeAsync(4001)
    await expect(p).resolves.toBeNull()
  })
})

describe('helpers', () => {
  it('the other provider', () => {
    expect(otherProvider('google')).toBe('line')
    expect(otherProvider('line')).toBe('google')
  })
  it('the link start URL lands on the connected screen, which reports every outcome', () => {
    expect(linkStartUrl('google')).toBe('/api/auth/link/start/google?return_to=%2Fv2%2Fsettings%2Fconnected')
  })
})
