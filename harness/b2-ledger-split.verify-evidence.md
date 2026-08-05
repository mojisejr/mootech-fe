# B-2 — Split bug-ledger into per-entry files (kill the append-conflict class)

**PR:** B-2 · **Owner:** goo · **Ledger:** `harness/bug-ledger/` (now a directory of per-entry files)
**ANCHOR: scripts/verify-ledger-integrity.test.ts#b2-dir-teeth**

## What changed & why

`harness/bug-ledger.json` was one JSON array of 80 entries. Every PR appends its
entry to the **end** of that one file, so two PRs in flight collide on the same
line region. This bit the team 4× — most recently #179 merging mid-stack forced a
4-way stacked rebase of #175–178. With ≥8 PRs coming next round (goo 5 + มุน 4) the
collision would be far worse.

Fix: each entry becomes its own file `harness/bug-ledger/<id>.json`. Adding an entry
= adding a new file → two PRs never touch the same path → **no conflict by
construction**. The gate reads the directory and aggregates.

The move is a pure relocation: **the 80 entries are preserved byte-for-byte** (id set
and content round-trip verified). Enforcement semantics are unchanged — I did not
touch `main-guard.yml` job B (provenance), did not weaken any check, and added one
*new* protection (empty-directory → fail, never silent-green).

## proof-of-teeth

The directory read path is proven to have the same teeth as the old file path, via
`scripts/verify-ledger-integrity.test.ts` (runs in CI's `scripts/*.test.ts` loop):
TEST 5 aggregates every per-entry file; TEST 6 positive control (all live → pass);
TEST 7 negative control (one entry's anchor dead → **fail**, not vacuous); TEST 8
empty directory → **fail** (no silent green). All 8 tests green.

### Proof 1 — MUTANT: a dead ledger anchor turns the gate RED; restore → GREEN
Snapshot-revert (cp, not in-place). Mutated `harness/bug-ledger/tier-gate.json`'s
`enforced_by` to a non-existent anchor:

```
>>> run gate on mutated ledger
GATE EXIT (mutated) = 1   (RED)
❌ [tier-gate] Anchor missing: 'THIS_ANCHOR_DOES_NOT_EXIST_b2mut' not found in scripts/verify-architecture.ts
🚨 Integrity Check FAILED. Some anchors are dead or evidence is invalid.

>>> restore from snapshot
GATE EXIT (restored) = 0   (GREEN)
✅ Integrity Check PASSED.
# git diff --stat on the entry = empty (fully restored)
```

### Proof 2 — run the script with NO path → exit 1 (no silent pass survives the split)
```
$ npx tsx scripts/verify-ledger-integrity.ts
EXIT (no args) = 1
Usage: bun scripts/verify-ledger-integrity.ts <path-to-ledger-dir-or-json> [path-to-evidence.md]
```

### Proof 3 — two branches each add a DIFFERENT entry → merge is conflict-free
The exact scenario that used to collide (both append an entry the same round):
```
>>> branch A adds harness/bug-ledger/mergetest-alpha.json
>>> branch B adds harness/bug-ledger/mergetest-beta.json   (different file)
>>> git merge B into A
Merge made by the 'ort' strategy.
 harness/bug-ledger/mergetest-beta.json | 5 +++++
MERGE EXIT = 0   (clean, NO conflict)
>>> unmerged paths: (none)
>>> both files present after merge: mergetest-alpha.json, mergetest-beta.json
```
(throwaway branches deleted; working tree returned clean)

### Proof 4 — entry count 80 == 80, id set unchanged, content byte-identical
```
files in harness/bug-ledger/: 80
diff ids-before.txt ids-after.txt → (empty)
✅ id set IDENTICAL — none lost, added, or renamed
```
The split migration re-aggregated the directory and deep-compared every entry object
to the source array (id set + JSON content) before deleting the monolith.

### Full gate green on the real 80-entry directory
```
$ npx tsx scripts/verify-ledger-integrity.ts harness/bug-ledger/
… 80 anchors …
✅ Integrity Check PASSED.
```
Plus: `tsc --noEmit` exit 0 · all 57 `scripts/*.test.ts` green · `verify-architecture.ts` pass.

## Callers & docs repointed (no dangling path)
- `.github/workflows/ci.yml` and `main-guard.yml` now pass `harness/bug-ledger/`
  (dir). Required-arg property preserved (bare run → exit 1). Provenance job untouched.
- Every doc reference to the old path repointed at `harness/bug-ledger/` or the exact
  per-entry file. `grep -rn "bug-ledger\.json"` across md/ts/yml = **0**. The pre-push
  append-conflict note is annotated as *resolved by B-2* (history kept, not erased).

## adversary sign-off

- **Not yet reviewed** — awaiting ตู๋ (static/AST) + a cross-oracle attempt to sneak a
  regression past the split. Refute targets for the adversary:
  1. Can an entry be **silently dropped** in the split? (claim: no — round-trip
     id-set + content deep-compare gates the delete; Proof 4.)
  2. Can the gate pass with **zero real checks** now that it reads a directory?
     (claim: no — empty dir fails, TEST 8; missing path throws, Proof 2.)
  3. Did enforcement **weaken** for any existing entry? (claim: no — entries are
     byte-identical; the only reader is verify-ledger-integrity.ts; provenance job
     untouched.)
- goo self-adversarial notes: the `tier-gate` entry uses an `anchor`/`teeth` schema
  with **no `enforced_by`**, so verifyLedger never checked it before *or* after — this
  is pre-existing and out of B-2 scope (I preserved it byte-for-byte; I did not change
  what the gate enforces). Flagging it so the adversary doesn't mistake it for a
  regression I introduced.
