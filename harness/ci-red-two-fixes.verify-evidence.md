# CI-red 2 fixes — gitleaks upload-off + narrow evidence-exemption (workflow-config-only)

**Run env:** macOS · node 20 · gitleaks 8.30.1 (brew, local) · verified at branch base main a4560da · 2026-08-07 · goo
**PR:** fix/ci-red-gitleaks-and-evidence-exemption (folds ฟีม's "เอาทั้ง 2 ข้อ") · **Owner:** goo
ANCHOR: harness/run-calendar-month.ts#mut-hardcode-tier

> ℹ️ The ANCHOR above is a **ledger-liveness sentinel** — a config PR has no bug-class of its own to anchor,
> and no-new-harness forbids committing the CI-logic mutants below as a persisted test. It proves the ledger
> gate still resolves; THIS PR's real teeth are the two mutants under proof-of-teeth (run live, shown). This
> PR does **not** use the workflow-only exemption it adds — it attaches this full evidence file (บอง's ruling).

## proof-of-teeth

### Fix 1 — gitleaks: only the SARIF *upload* is turned off; the SCAN still bites
- `GITLEAKS_ENABLE_UPLOAD_ARTIFACT: false` is the action's own documented switch (verified at
  gitleaks/gitleaks-action v2 README — default true; controls the artifact upload, not detection/exit).
  NOT `continue-on-error`, NOT `|| true` — the scan config is byte-unchanged.
- **MUTANT (ran, gitleaks 8.30.1):** a file with a fake AWS key `AKIA…` → `gitleaks detect` **exit 1**,
  "leaks found: 1" (RuleID generic-api-key). **NEGATIVE CONTROL:** a clean file → exit 0, "no leaks found".
  The instrument is valid and still red on a secret. (Scanned isolated fake files, never the repo; no real
  secret surfaced.)

### Fix 2 — narrow evidence-exemption: works, and cannot be abused (D2 decision unit-tested)
The exact bash decision from ci.yml was replicated and run against **8 cases** — all as required:
| case | input | result |
|---|---|---|
| app file, no evidence | not exempt | **FAIL** (attach evidence) |
| any files + evidence | normal path | **PASS** |
| workflow-only edit, no `## why-no-evidence` | must speak | **FAIL** |
| workflow-only edit, WITH `## why-no-evidence` | exempt | **PASS** |
| **workflow DELETION** (+ why present) | removing a gate | **FAIL** (needs full evidence) |
| workflow edit + a sneaky app file (+ why) | can't smuggle | **FAIL** |
| **7A · RENAME `ci.yml → ci.yml.disabled`** (+ why) | kills a gate for free | **FAIL** (deletes a workflow) |
| **7B · RENAME `features/foo.ts → workflows/foo.ts`** (+ why) | hides a product file | **FAIL** (non-workflow file) |

🔴 **7A/7B are the bypass ตู๋ caught (v1 of this PR let them through).** git sees `git mv` as a RENAME (one
entry, the DEST path), so a rename showed 0-files-outside-workflows AND 0-deletions — slipping BOTH guards.
Fix: **`--no-renames` on both diff calls** (ci.yml) → a rename splits into DELETE(old)+ADD(new), so the
delete-guard sees the deleted workflow (7A) and the non-workflow guard sees the moved-out source (7B).
⇒ the hole บอง+ตู๋ named (rip out / rename-disable a gate for free) is CLOSED; the exemption relaxes only the
evidence FILE, never the "must speak" rule.

**Regression guard (so it can't come back silently):** `scripts/d2-gate-guard.test.ts` — CI-run (ci.yml runs
`scripts/*.test.ts`), asserts on the ci.yml SOURCE that EVERY `git diff --name-only origin/main` in the D2
gate carries `--no-renames`, plus the delete/non-workflow/must-speak guards. **Mutant-proven:** strip
`--no-renames` from ci.yml → the test goes RED (assertion fails); restore → green.

🟡 **KNOWN debt, NOT fixed here (ตู๋+บอง agreed):** a MODIFY that guts a workflow in place (e.g. rewrite the
gate body to `run: true`) is neither delete nor rename, so `--no-renames` does not catch it. It is NOT free,
though — a modify still touches only `.github/workflows/**`, so it lands in the exemption and MUST carry a
`## why-no-evidence` section: gutting a gate becomes a written admission in the PR, never a silent pass. A
future fix (logged) is a D2 lane for CI-config PRs that verifies the workflow still runs its gates, not just
that files exist. See [[anchor-rule-gap-self-modifying-gate-pr]].

### Static
- Both workflows valid YAML. tsc 0 · `verify-architecture` passed · scripts spot-check green (yml-only change,
  no .ts touched). Counted/based at main a4560da.

## adversary sign-off
Refute targets for ตู๋ (run them):
- **Does the gitleaks env silence detection, not just upload?** — no: mutant shows exit 1 on a fake secret
  AFTER the change; the switch is the action's upload toggle, not `continue-on-error`.
- **Can a PR that removes a gate slip through the exemption?** — for DELETE, RENAME, and moving-a-file-in:
  no. (⚠️ correction: v1 of this PR claimed "disables — no" but had only tested DELETE, not RENAME — ตู๋
  found `git mv ci.yml ci.yml.disabled` passed. Fixed with `--no-renames` + cases 7A/7B + a CI regression
  guard.) The ONE removal shape still open is a MODIFY that guts a gate in place — logged as debt above; it
  is not free (must write `## why-no-evidence`). Try: rename a workflow out/in, or move a product file into
  workflows, with only a why-body → still FAIL. Try stripping `--no-renames` → `d2-gate-guard.test.ts` red.
- **Did the exemption weaken the gate for app/harness PRs?** — no: those still require verify-evidence.md
  (unchanged normal path); #198 (harness, 81 files) still needs its evidence.
- **Is "gitleaks still bites" cited from memory?** — no: gitleaks 8.30.1 run locally, exit 1 shown.
- goo self-adversarial: the danger of this PR is "relaxing a gate quietly." The exemption is deliberately the
  narrowest that removes the ritual (config-only, no delete, must still speak) and is proven by mutant not
  by assertion; and this PR does not use its own exemption.
