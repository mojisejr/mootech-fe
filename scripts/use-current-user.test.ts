// Deterministic unit tests for client identity resolution (#mootech-identity-guard-sweep).
// DB-free, React-free (pure resolveAuth logic). Run: npx tsx scripts/use-current-user.test.ts
//                                                or: bun scripts/use-current-user.test.ts
import assert from 'node:assert/strict'
import { resolveAuth, UUID_RE } from '../lib/auth/resolve-auth'

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

const UUID = '11111111-2222-4333-8444-555555555555'

// ── THE VOW: session valid but id cookie not landed yet -> loading, NEVER anon ──
t('authenticated + no cookie -> loading (never anon = the bounce bug)', () => {
  assert.deepEqual(resolveAuth('authenticated', ''), { userId: '', status: 'loading' })
})

t('authenticated + null/undefined cookie -> loading', () => {
  assert.equal(resolveAuth('authenticated', null).status, 'loading')
  assert.equal(resolveAuth('authenticated', undefined).status, 'loading')
})

// ── authed: a resolved uuid identity is safe regardless of session timing ──
t('authenticated + uuid cookie -> authed + userId', () => {
  assert.deepEqual(resolveAuth('authenticated', UUID), { userId: UUID, status: 'authed' })
})

t('unauthenticated + uuid cookie -> authed (cookie identity wins, safe to fetch)', () => {
  assert.deepEqual(resolveAuth('unauthenticated', UUID), { userId: UUID, status: 'authed' })
})

// ── loading session ──
t('loading + no cookie -> loading', () => {
  assert.equal(resolveAuth('loading', '').status, 'loading')
})

// ── anon ONLY when no session AND no id ──
t('unauthenticated + no cookie -> anon (only safe time to /login)', () => {
  assert.deepEqual(resolveAuth('unauthenticated', ''), { userId: '', status: 'anon' })
})

// ── uuid filter: garbage / stale access token is "not resolved yet", never fetched ──
t('authenticated + ya29 access token -> loading, no userId (never fetch garbage)', () => {
  assert.deepEqual(resolveAuth('authenticated', 'ya29.A0ARrdaM-fake-token'), {
    userId: '',
    status: 'loading',
  })
})

t('unauthenticated + garbage cookie -> anon (non-uuid is not an identity)', () => {
  assert.deepEqual(resolveAuth('unauthenticated', 'not-a-uuid'), { userId: '', status: 'anon' })
})

// ── UUID_RE shape ──
t('UUID_RE accepts a real uuid, rejects access tokens / junk', () => {
  assert.ok(UUID_RE.test(UUID))
  assert.ok(!UUID_RE.test('ya29.A0ARrdaM'))
  assert.ok(!UUID_RE.test(''))
  assert.ok(!UUID_RE.test('11111111-2222-4333-8444'))
})

if (!process.exitCode) console.log(`✓ all ${pass} use-current-user assertions passed`)
else console.error(`\n${pass} passed, FAILURES above`)
