// Lean-CI workflow-integrity guard (goo · Phase 1 — replaces the D2 evidence-gate).
// ONE job: a PR that DELETES or RENAMES a CI workflow goes RED, because removing a gate is the
// highest-stakes change and must be deliberate. It is SILENT for every PR that does not touch
// .github/workflows/. There is NO evidence requirement here — this is "red when a gate disappears",
// nothing more (the old D2 presence/architecture gate is gone; verify-architecture is now its own step).
//
// Rename detection rides on --no-renames (ตู๋ #199): `git mv ci.yml ci.yml.disabled` is ONE rename entry
// (the dest path) to plain git — 0 deletions — so it would slip. --no-renames splits a rename into
// DELETE(old)+ADD(new), so the deleted workflow surfaces; --diff-filter=D lists exactly the deleted paths.
//
// Intentional gate removal IS allowed, but must be SPOKEN: the PR body must carry a
// '## intentional-workflow-change' section (what gate is going · why · what still bites). ตู๋ reviews it.
//
// Inputs (env): BASE_REF (default origin/main) · PR_BODY (the PR description).
// Run: BASE_REF=origin/main PR_BODY="$BODY" npx tsx scripts/guard-workflow-integrity.ts
import { execSync } from 'node:child_process'

export const INTENT_MARKER = '## intentional-workflow-change'
const WORKFLOW_PREFIX = '.github/workflows/'

/** The exact diff command that surfaces deleted/renamed workflow files. --no-renames is LOAD-BEARING. */
export function deletedWorkflowsCmd(baseRef: string): string {
  return `git diff --name-only --no-renames --diff-filter=D ${baseRef}...HEAD`
}

/** Deleted (incl. renamed-away) workflow files vs baseRef, computed from real git history. */
export function deletedWorkflows(baseRef: string): string[] {
  const out = execSync(deletedWorkflowsCmd(baseRef), { encoding: 'utf8' })
  return out
    .split('\n')
    .map((s) => s.trim())
    .filter((p) => p.startsWith(WORKFLOW_PREFIX))
}

/** Pure decision: given deleted workflow paths + PR body, may this PR pass? */
export function evaluate(deleted: string[], prBody: string): { ok: boolean; reason: string } {
  if (deleted.length === 0) return { ok: true, reason: 'no workflow deleted or renamed' }
  if (new RegExp(INTENT_MARKER, 'i').test(prBody)) {
    return { ok: true, reason: `intentional: ${deleted.length} workflow(s) removed with '${INTENT_MARKER}' in body` }
  }
  return {
    ok: false,
    reason: `${deleted.length} workflow file(s) deleted/renamed without '${INTENT_MARKER}' in the PR body: ${deleted.join(', ')}`,
  }
}

function main(): void {
  const baseRef = process.env.BASE_REF || 'origin/main'
  const prBody = process.env.PR_BODY || ''
  const { ok, reason } = evaluate(deletedWorkflows(baseRef), prBody)
  if (ok) {
    console.log(`✅ workflow-integrity: ${reason}`)
    return
  }
  console.error(`❌ workflow-integrity: ${reason}`)
  console.error(`   Removing or renaming a CI gate is deliberate work. If this is intentional, add a`)
  console.error(`   '${INTENT_MARKER}' section to the PR body stating what gate is going, why, and what still bites.`)
  process.exit(1)
}

// Run only when executed directly, so the *.test.ts can import the pure helpers without side effects.
if (import.meta.url === `file://${process.argv[1]}`) main()
