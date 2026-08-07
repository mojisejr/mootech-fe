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
The exact bash decision from ci.yml was replicated and run against 6 cases — all as required:
| case | input | result |
|---|---|---|
| app file, no evidence | not exempt | **FAIL** (attach evidence) |
| any files + evidence | normal path | **PASS** |
| workflow-only edit, no `## why-no-evidence` | must speak | **FAIL** |
| workflow-only edit, WITH `## why-no-evidence` | exempt | **PASS** |
| **workflow DELETION** (+ why present) | removing a gate | **FAIL** (needs full evidence) |
| workflow edit + a sneaky app file (+ why) | can't smuggle | **FAIL** |

⇒ the hole บอง named (a PR that rips out a workflow passing free) is CLOSED by the delete-guard
(`--diff-filter=D`), and the exemption relaxes only the evidence FILE, never the "must speak" rule.

### Static
- Both workflows valid YAML. tsc 0 · `verify-architecture` passed · scripts spot-check green (yml-only change,
  no .ts touched). Counted/based at main a4560da.

## adversary sign-off
Refute targets for ตู๋ (run them):
- **Does the gitleaks env silence detection, not just upload?** — no: mutant shows exit 1 on a fake secret
  AFTER the change; the switch is the action's upload toggle, not `continue-on-error`.
- **Can a PR that deletes/disables a gate slip through the exemption?** — no: delete of a `.github/workflows/`
  file → not exempt (case 5); any non-workflow file → not exempt (cases 1, 6). Try adding a file outside
  workflows, or deleting a workflow, with only a `## why-no-evidence` body → still FAIL.
- **Did the exemption weaken the gate for app/harness PRs?** — no: those still require verify-evidence.md
  (unchanged normal path); #198 (harness, 81 files) still needs its evidence.
- **Is "gitleaks still bites" cited from memory?** — no: gitleaks 8.30.1 run locally, exit 1 shown.
- goo self-adversarial: the danger of this PR is "relaxing a gate quietly." The exemption is deliberately the
  narrowest that removes the ritual (config-only, no delete, must still speak) and is proven by mutant not
  by assertion; and this PR does not use its own exemption.
