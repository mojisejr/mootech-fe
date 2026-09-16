// Deterministic unit tests for matching-navigation routing (#mootech-login-loop-fix-v2).
// DB-free, React-free (pure resolveMatchingTarget logic).
// Run: npx tsx scripts/matching-target.test.ts   or: bun scripts/matching-target.test.ts
import assert from 'node:assert/strict'
import { resolveMatchingTarget } from '../lib/auth/matching-target'
import { test as t } from 'vitest'



// ── happy path: refer-code present -> /matching/:code (unchanged behaviour) ──
t('refer-code present + authed -> go-matching with code', () => {
  assert.deepEqual(resolveMatchingTarget(true, 'ABC123'), { kind: 'go-matching', code: 'ABC123' })
})

t('refer-code present trims whitespace', () => {
  assert.deepEqual(resolveMatchingTarget(true, '  ABC123  '), { kind: 'go-matching', code: 'ABC123' })
})

t('refer-code present even when authed flag is false -> still go-matching (code is identity)', () => {
  assert.deepEqual(resolveMatchingTarget(false, 'ABC123'), { kind: 'go-matching', code: 'ABC123' })
})

// ── THE VOW: authed + empty refer-code -> backfill, NEVER /login (the loop bug) ──
t('authed + empty refer-code -> needs-backfill (NEVER go-login = the loop bug)', () => {
  assert.deepEqual(resolveMatchingTarget(true, ''), { kind: 'needs-backfill' })
})

t('authed + null/undefined refer-code -> needs-backfill', () => {
  assert.equal(resolveMatchingTarget(true, null).kind, 'needs-backfill')
  assert.equal(resolveMatchingTarget(true, undefined).kind, 'needs-backfill')
})

t('authed + whitespace-only refer-code -> needs-backfill (not go-matching with blank)', () => {
  assert.deepEqual(resolveMatchingTarget(true, '   '), { kind: 'needs-backfill' })
})

// ── anon ONLY when not authed AND no code ──
t('anon + empty refer-code -> go-login (only safe time to /login)', () => {
  assert.deepEqual(resolveMatchingTarget(false, ''), { kind: 'go-login' })
})

t('anon + null refer-code -> go-login', () => {
  assert.equal(resolveMatchingTarget(false, null).kind, 'go-login')
})

