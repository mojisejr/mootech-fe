// #363 — teeth for "we tokenize with the v2 key, at the moment it matters". MAIN lane.
//
// 🔴 MUTANT CONTRACT:
//   MU1  set the key on mount instead of before createToken → "set immediately before" reddens
//   MU2  fall back to NEXT_PUBLIC_OMISE_KEY when _V2 is absent → "never borrows v1's live key" reddens
//   MU3  read NEXT_PUBLIC_OMISE_KEY outright                   → same test
//
// 🔑 WHY ORDER IS A CORRECTNESS PROPERTY HERE. window.Omise is one object for the whole app and
// setPublicKey mutates it. v1's five payment pages set it to the LIVE key on their own mount. Whoever ran
// last wins, so "we set it when we mounted" is only true until the user walks through a v1 page. The test
// therefore asserts the ORDER of the two calls, not merely that both happened.
import { readFileSync } from 'node:fs'
import { describe, it, expect, vi } from 'vitest'
import { createCardToken, v2OmiseKey, V2_OMISE_KEY_ENV, OmiseKeyMissingError } from '@/features/v2-shop/omise-token'

const FIELDS = { name: 'David Watson', number: '4242 4242 4242 4242', expMonth: '04', expYear: '2026', cvc: '457' }

describe('#363 which key, and when', () => {
  it('🔴 setPublicKey happens IMMEDIATELY BEFORE createToken, not earlier', async () => {
    const order: string[] = []
    const omise = {
      setPublicKey: (k: string) => order.push(`set:${k}`),
      createToken: (_k: 'card', _f: Record<string, string>, cb: (s: number, r: { id: string }) => void) => {
        order.push('createToken')
        cb(200, { id: 'tokn_x' })
      },
    }
    process.env[V2_OMISE_KEY_ENV] = 'pkey_test_v2'
    await expect(createCardToken(FIELDS, omise)).resolves.toBe('tokn_x')
    expect(order).toEqual(['set:pkey_test_v2', 'createToken'])
  })

  it('🔴 a missing v2 key STOPS the screen — it never borrows v1\'s live key', () => {
    // The fallback that would look helpful and would silently charge through v1's live credentials, or
    // (worse) make v1 tokenize against test once someone swapped it to try this screen.
    expect(() => v2OmiseKey({ NEXT_PUBLIC_OMISE_KEY: 'pkey_live_v1' })).toThrow(OmiseKeyMissingError)
    expect(() => v2OmiseKey({})).toThrow(OmiseKeyMissingError)
    expect(v2OmiseKey({ [V2_OMISE_KEY_ENV]: 'pkey_test_v2' })).toBe('pkey_test_v2')
  })

  it('the source never mentions v1\'s env name outside a comment', () => {
    const src = readFileSync('features/v2-shop/omise-token.ts', 'utf8')
    const code = src.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter((l: string) => !/^\s*(\/\/|\*)/.test(l)).join('\n')
    expect(code).not.toContain('NEXT_PUBLIC_OMISE_KEY"')
    expect(code).not.toMatch(/NEXT_PUBLIC_OMISE_KEY(?!_V2)\b/)
  })

  it('card number spacing from the design placeholder is stripped before it is sent', async () => {
    let sent: Record<string, string> = {}
    const omise = {
      setPublicKey: () => {},
      createToken: (_k: 'card', f: Record<string, string>, cb: (s: number, r: { id: string }) => void) => {
        sent = f; cb(200, { id: 'tokn_y' })
      },
    }
    process.env[V2_OMISE_KEY_ENV] = 'pkey_test_v2'
    await createCardToken(FIELDS, omise)
    expect(sent.number).toBe('4242424242424242')
    expect(sent.security_code).toBe('457') // the design says CVC, and this is the field it maps to
  })

  it('a refused token rejects with the gateway\'s message, not a generic one', async () => {
    const omise = {
      setPublicKey: () => {},
      createToken: (_k: 'card', _f: Record<string, string>, cb: (s: number, r: { message: string }) => void) =>
        cb(400, { message: 'number is invalid' }),
    }
    process.env[V2_OMISE_KEY_ENV] = 'pkey_test_v2'
    await expect(createCardToken(FIELDS, omise)).rejects.toThrow('number is invalid')
  })
})
