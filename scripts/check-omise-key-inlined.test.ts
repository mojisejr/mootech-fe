// Teeth for scripts/check-omise-key-inlined.sh — mootech-fe#482 added a SECOND skip branch (a developer's
// own machine) and a skip branch is the most dangerous thing you can add to a gate: widen it by one
// condition and the gate goes green on a deploy whose key was never set, which is mootech-fe#432 back
// again with every card payment on /v2 dead before a request leaves the browser.
//
// So this file does not test that the skip works. It tests THE SHAPE OF THE HOLE: exactly one combination
// skips, and every neighbouring combination still reddens. A test that only asserted the skip would pass
// just as happily if the condition were `true`.
//
// Round 2 added the VERCEL_ENV leg after ตู๋ found the hole by firing the combination this file did
// not have a case for — which is the argument for the table growing by a row every time, not by a rewrite.
//
// The script is run for real against a throwaway static dir — no mocking, because the thing that can be
// wrong is the shell condition itself.
// Run: npx tsx scripts/check-omise-key-inlined.test.ts
//
// ANCHOR: scripts/check-omise-key-inlined.test.ts#omise-key-gate-skip-shape
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const GATE = resolve('scripts/check-omise-key-inlined.sh')
assert.ok(existsSync(GATE), `${GATE} must exist`)

// A key long enough to clear the >=12-char guard, and short enough to read in a failure message.
const PRESENT_KEY = 'pkey_test_INBUNDLE_0123456789'
const ABSENT_KEY = 'pkey_test_NOTINBUNDLE_9876543'

const dir = mkdtempSync(join(tmpdir(), 'omise-gate-'))
const staticDir = join(dir, 'static')
writeFileSync(join(dir, 'placeholder'), '')
execFileSync('mkdir', ['-p', staticDir])
// The bundle contains PRESENT_KEY and not ABSENT_KEY — that is what lets one case pass and one redden.
writeFileSync(join(staticDir, 'chunk.js'), `var k="${PRESENT_KEY}";\n`)

/**
 * Run the gate with a FULLY CONTROLLED environment.
 *
 * 🔴 The ambient env is stripped, not merged. A developer with NEXT_PUBLIC_OMISE_KEY_V2 exported in their
 * shell, or CI=true from the runner, would otherwise silently change what each case is actually testing —
 * and the case that matters most ("local, no key → skip") is exactly the one that flips.
 */
function runGate(env: Record<string, string>): { rc: number; out: string } {
  try {
    const out = execFileSync('bash', [GATE], {
      env: { PATH: process.env.PATH ?? '', STATIC_DIR: staticDir, ...env },
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    return { rc: 0, out }
  } catch (e) {
    const err = e as { status?: number; stdout?: string; stderr?: string }
    return { rc: err.status ?? -1, out: `${err.stdout ?? ''}${err.stderr ?? ''}` }
  }
}

type Case = { name: string; env: Record<string, string>; rc: number; expect?: RegExp }

const cases: Case[] = [
  // ── the one hole this change opens ────────────────────────────────────────────────────────────────
  {
    name: 'local build, no key → SKIPS, and says so',
    env: {},
    rc: 0,
    // A silent skip and a clean pass must never print the same thing (the file's own rule).
    expect: /SKIPPED — local build, no key set/,
  },

  // ── every neighbour of that hole must still redden ────────────────────────────────────────────────
  // If any of these goes green, the skip condition is too wide and #432 is live again.
  { name: 'VERCEL set, no key → RED', env: { VERCEL: '1' }, rc: 1 },
  { name: 'VERCEL production, no key → RED', env: { VERCEL: '1', VERCEL_ENV: 'production' }, rc: 1 },
  { name: 'CI set, no key → RED', env: { CI: 'true' }, rc: 1 },
  // 🔴 ตู๋, review of 6bb05d7: the first version tested VERCEL alone, so this exact call SKIPPED and
  // printed "local build". VERCEL_ENV is a separate leg because the preview branch above keys on it —
  // one file must not hold two different answers to "are we on Vercel".
  { name: 'VERCEL_ENV set without VERCEL, no key → RED', env: { VERCEL_ENV: 'production' }, rc: 1 },
  { name: 'VERCEL_ENV=development without VERCEL, no key → RED', env: { VERCEL_ENV: 'development' }, rc: 1 },
  {
    // Whitespace is somebody's mistake, not an absence. It must fall through the skip, not be swallowed.
    // (The MESSAGE it prints is still wrong — that is mootech-fe#435, deliberately not fixed here.)
    name: 'local build, key is whitespace → RED, not skipped',
    env: { NEXT_PUBLIC_OMISE_KEY_V2: '   ' },
    rc: 1,
  },
  {
    name: 'local build, key set but absent from bundle → RED',
    env: { NEXT_PUBLIC_OMISE_KEY_V2: ABSENT_KEY },
    rc: 1,
    expect: /VALUE is absent/,
  },
  { name: 'local build, key too short → RED', env: { NEXT_PUBLIC_OMISE_KEY_V2: 'pkey_x' }, rc: 1 },

  // ── the real pass, and the pre-existing preview branch, both unchanged by #482 ─────────────────────
  {
    name: 'key set and present in bundle → GREEN',
    env: { NEXT_PUBLIC_OMISE_KEY_V2: PRESENT_KEY },
    rc: 0,
    expect: /reached the client bundle/,
  },
  {
    name: 'Vercel preview, no key → SKIPS via the preview branch (unchanged)',
    env: { VERCEL: '1', VERCEL_ENV: 'preview' },
    rc: 0,
    expect: /SKIPPED — VERCEL_ENV=preview/,
  },
]

let failures = 0
for (const c of cases) {
  const { rc, out } = runGate(c.env)
  try {
    assert.equal(rc, c.rc, `${c.name}: expected rc=${c.rc}, got ${rc}\n${out}`)
    if (c.expect) assert.match(out, c.expect, `${c.name}: output did not match ${c.expect}\n${out}`)
    console.log(`  ✓ ${c.name}`)
  } catch (e) {
    failures += 1
    console.error(`  ✗ ${(e as Error).message}`)
  }
}

rmSync(dir, { recursive: true, force: true })

if (failures > 0) {
  console.error(`\n${failures} case(s) failed — the gate's skip condition is not the shape #482 agreed to.`)
  process.exit(1)
}
console.log(`\nomise key gate: ${cases.length}/${cases.length} cases hold.`)
