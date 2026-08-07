// Regression guard for the D2 evidence-gate in .github/workflows/ci.yml (goo · ตู๋ #199).
// Plain tsx + node:assert (ci.yml runs `for f in scripts/*.test.ts`), so THIS runs in the very gate it guards.
//
// ตู๋ found a real bypass: the workflow-config-only exemption trusted `git diff` to tell delete from move,
// but `git mv ci.yml ci.yml.disabled` is a RENAME (git shows one entry, the DEST path) → 0 files outside
// workflows AND 0 deletions → both guards slip → a gate dies for free. `git mv features/x.ts workflows/x.ts`
// hides a product file the same way. The fix is `--no-renames` on BOTH diff calls (a rename then splits into
// DELETE(old)+ADD(new), so guard-a sees the non-workflow source and guard-b sees the deleted workflow).
//
// This test fails RED the moment `--no-renames` is dropped from either diff, or a `git diff --name-only`
// without it is added — so the bypass cannot come back silently. It asserts on the ci.yml SOURCE (single
// source of truth); the behavioural 8-case proof (incl. both renames) is in harness/ci-red-two-fixes.verify-evidence.md.
import assert from 'node:assert'
import { readFileSync } from 'node:fs'

const yml = readFileSync('.github/workflows/ci.yml', 'utf8')

// pull the D2 gate step's run: block (from its name to the next `- name:`), so we only assert on IT.
const start = yml.indexOf('D2 Auto-Gate')
assert.ok(start >= 0, 'FAIL: D2 Auto-Gate step not found in ci.yml — did the gate get renamed/removed?')
const rest = yml.slice(start)
const next = rest.indexOf('\n      - name:')
const d2 = next > 0 ? rest.slice(0, next) : rest

let pass = 0
const ok = (name: string, cond: boolean) => { assert.ok(cond, `FAIL: ${name}`); pass += 1 }

// 1. EVERY `git diff --name-only … origin/main` inside the D2 gate MUST carry --no-renames (the bypass fix).
const diffLines = d2.split('\n').filter((l) => /git diff --name-only/.test(l) && /origin\/main/.test(l))
ok('D2 gate makes at least the 2 expected git-diff calls', diffLines.length >= 2)
for (const l of diffLines) {
  ok(`git-diff carries --no-renames → ${l.trim().slice(0, 70)}`, /--no-renames/.test(l))
}

// 2. the two structural guards + the must-speak rule are still present (so the exemption stays narrow).
ok('delete-guard present (--diff-filter=D on workflows → block)', /--diff-filter=D[\s\S]*workflows/.test(d2) && /DELETED_WF/.test(d2))
ok('non-workflow guard present (files outside workflows → block)', /NON_WF/.test(d2) && /grep -v '\^\\\.github\/workflows\/'/.test(d2))
ok('must-speak rule present (why-no-evidence required in body)', /## why-no-evidence/i.test(d2) && /PR_BODY/.test(d2))

console.log(`✅ d2-gate-guard.test.ts — ${pass} assertions passed (D2 rename-bypass fix is in place)`)
