// Deterministic unit tests for the bazi chat access gate (#mootech-bazi-chat-lane).
// DB-free, identity-free (pure allowlist logic). Run: npx tsx scripts/chat-access.test.ts
//                                               or: bun scripts/chat-access.test.ts
import assert from 'node:assert/strict'
import { parseTesters, resolveChatAccess } from '../lib/chat/access'

let pass = 0
function t(name: string, fn: () => void) {
  try {
    fn()
    pass++
  } catch (e: any) {
    console.error(`✗ ${name}\n  ${e?.message ?? e}`)
    process.exitCode = 1
  }
}

// ── parseTesters ──
t('parseTesters empty/undefined -> []', () => {
  assert.deepEqual(parseTesters(undefined), [])
  assert.deepEqual(parseTesters(''), [])
  assert.deepEqual(parseTesters(null), [])
})
t('parseTesters CSV trims + lowercases + drops blanks', () => {
  assert.deepEqual(
    parseTesters(' A@x.com , , B@Y.com ,uuid-1 '),
    ['a@x.com', 'b@y.com', 'uuid-1'],
  )
})

// ── resolveChatAccess: identity required ──
t('no userId -> false even if public', () => {
  assert.equal(
    resolveChatAccess({ userId: '', email: 'a@x.com', publicEnabled: true, testers: [] }),
    false,
  )
  assert.equal(
    resolveChatAccess({ userId: null, publicEnabled: true, testers: ['a@x.com'] }),
    false,
  )
})

// ── public switch ──
t('public open -> any logged-in user true', () => {
  assert.equal(
    resolveChatAccess({ userId: 'uuid-9', publicEnabled: true, testers: [] }),
    true,
  )
})

// ── allowlist by user_id ──
t('userId on allowlist -> true (case-insensitive)', () => {
  assert.equal(
    resolveChatAccess({ userId: 'UUID-1', publicEnabled: false, testers: ['uuid-1'] }),
    true,
  )
})
t('userId not on allowlist, no email -> false', () => {
  assert.equal(
    resolveChatAccess({ userId: 'uuid-2', publicEnabled: false, testers: ['uuid-1'] }),
    false,
  )
})

// ── allowlist by email ──
t('email on allowlist -> true (case-insensitive)', () => {
  assert.equal(
    resolveChatAccess({
      userId: 'uuid-2',
      email: 'NON@Mumate.co',
      publicEnabled: false,
      testers: ['non@mumate.co'],
    }),
    true,
  )
})
t('empty email is never matched', () => {
  assert.equal(
    resolveChatAccess({ userId: 'uuid-2', email: '', publicEnabled: false, testers: [''] }),
    false,
  )
})

if (!process.exitCode) console.log(`✓ all ${pass} chat-access assertions passed`)
else console.error(`\n${pass} passed, FAILURES above`)
