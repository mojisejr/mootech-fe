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
import { resolveResetIdentity, resolveUserFromRows } from '@/lib/v2/first-run-reset'

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

// ── B2 (ตู๋, #254) — which row may we DELETE for? ─────────────────────────────────────────────
// The lookup matches provider case-INsensitively while the app's own dedupe matches case-SENSITIVELY
// (mootech-be user-provider.service.ts:32) and nothing enforces uniqueness on (id_token, provider).
// So two rows for one human CAN exist. The old code took `LIMIT 1` with no ORDER BY = "whichever row
// the planner returns first", which changes after writes/vacuum ⇒ a chance to wipe the wrong person.
//
// 🔴 MUTANT CONTRACT — each must go RED alone:
//   B2a  go back to "just take the first row" (drop the >1 refusal)
//   B2b  treat "no rows" as success
//   B2c  dedupe by ROW instead of by user_id (two identical rows would then read as ambiguous and
//        start refusing a perfectly normal duplicate — a false 409 is a broken button)
describe('B2 — an ambiguous identity must refuse, not guess', () => {
  it('one row ⇒ that user', () => {
    const r = resolveUserFromRows([{ user_id: 'u-1' }])
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.userId).toBe('u-1')
  })

  it('B2c — duplicate rows for the SAME user are not ambiguous (still one user_id)', () => {
    const r = resolveUserFromRows([{ user_id: 'u-1' }, { user_id: 'u-1' }, { user_id: 'u-1' }])
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.userId).toBe('u-1')
  })

  it('🔴 B2a — two DIFFERENT users ⇒ 409, and no user is chosen', () => {
    const r = resolveUserFromRows([{ user_id: 'u-1' }, { user_id: 'u-2' }])
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.status).toBe(409)
    expect(JSON.stringify(r)).not.toContain('u-1')
    expect(JSON.stringify(r)).not.toContain('u-2')
  })

  it('🔴 B2b — no rows ⇒ 404, never a silent success', () => {
    const r = resolveUserFromRows([])
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.status).toBe(404)
  })

  it('blank / non-string user_id is not an identity', () => {
    for (const rows of [[{ user_id: '' }], [{ user_id: '   ' }], [{ user_id: null }], [{}]]) {
      const r = resolveUserFromRows(rows as Array<{ user_id?: unknown }>)
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.status).toBe(404)
    }
  })

  it('one real user + junk rows ⇒ still that user (junk is not a second identity)', () => {
    const r = resolveUserFromRows([{ user_id: '' }, { user_id: 'u-9' }, {}])
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.userId).toBe('u-9')
  })
})
