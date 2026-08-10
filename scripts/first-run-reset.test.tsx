// #249 — teeth for the team-preview reset. .tsx on purpose: ci.yml's tsx lane globs `scripts/*.test.ts`,
// so a .tsx spec is invisible to it and needs NO entry in that lane's skip list — the same trick #220
// and #225 use, and the reason debt #212 (two hand-synced lists) does not grow because of this file.
// Registered in vitest.config.mts `include` (APPEND — never replace a line there, see the ⚠️ at its top).
//
// 🔴 MUTANT CONTRACT — this endpoint DELETES rows on prod. Each of these must go RED on its own:
//   M1  let the caller name the subject (read user_id from the body/cookie instead of the session)
//   M2  drop the preview-gate check (`v2Authenticated`) — an endpoint that deletes must never be
//       reachable outside the gate
//   M3  accept a request with no signed session (fall back to "" / a cookie)
// M1 is the whole reason lib/v2/first-run-reset.ts exists as a separate pure module: `resolveResetIdentity`
// has NO input field a client can populate, so M1 cannot even be expressed without editing its type.
import { describe, expect, it } from 'vitest'
import { resolveResetIdentity } from '@/lib/v2/first-run-reset'

const SIGNED = { providerId: 'U1234567890abcdef', provider: 'line' }

describe('who is allowed to reset, and whose row it is', () => {
  it('team preview + signed in ⇒ allowed, and the identity is the CALLER (M1)', () => {
    const r = resolveResetIdentity({ ...SIGNED, v2Authenticated: true })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.providerId).toBe('U1234567890abcdef')
      expect(r.provider).toBe('line')
    }
  })

  it('M2 — outside the preview gate ⇒ 401, even with a perfectly good session', () => {
    const r = resolveResetIdentity({ ...SIGNED, v2Authenticated: false })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.status).toBe(401)
  })

  it('M3 — no signed session ⇒ 401, never a fallback identity', () => {
    for (const bad of [undefined, null, '', '   ']) {
      const r = resolveResetIdentity({ providerId: bad, provider: 'line', v2Authenticated: true })
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.status).toBe(401)
    }
  })

  it('M3 — provider missing is just as fatal as providerId missing', () => {
    const r = resolveResetIdentity({ providerId: 'U123', provider: '', v2Authenticated: true })
    expect(r.ok).toBe(false)
  })

  it('gate is checked BEFORE the session — an unauthenticated stranger outside the gate gets 401, not a hint', () => {
    const r = resolveResetIdentity({ providerId: '', provider: '', v2Authenticated: false })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toBe('not in team preview')
  })
})

describe('M1 — the shape itself forbids a caller-named subject', () => {
  it('resolveResetIdentity ignores any extra field a caller tries to smuggle in', () => {
    // A route that later "helpfully" forwards req.body would have to pass it HERE to have any effect.
    // It cannot: the returned identity is built only from providerId/provider.
    const r = resolveResetIdentity({
      ...SIGNED,
      v2Authenticated: true,
      // @ts-expect-error — proving the type has no door for this; if this line ever compiles, M1 is live
      userId: 'someone-elses-user-id',
    })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.providerId).toBe(SIGNED.providerId)
    expect(Object.values(r)).not.toContain('someone-elses-user-id')
  })
})
