// Lean-CI workflow-integrity guard (goo · Phase 1 — replaces the D2 evidence-gate).
// ONE narrow job: a PR that DELETES or RENAMES a CI workflow FILE goes RED, because removing a gate
// this way must be deliberate. It is SILENT for every PR that does not touch .github/workflows/.
//
// ⚠️ SCOPE (ตู๋ F2, #200): this guards the FILE existing, NOT the gate still having teeth. A PR can still
// neuter a gate in place — gut its steps, flip `on:` to workflow_dispatch, wrap a run in `if: false` or
// `|| true` — and this guard stays green (the old D2 gate had the same blind spot; not a regression).
// The step name is deliberately "…deleted/renamed…", not "gate-integrity", so no one over-trusts it.
//
// Rename detection rides on --no-renames (ตู๋ #199): `git mv ci.yml ci.yml.disabled` is ONE rename entry
// (the dest path) to plain git — 0 deletions — so it would slip. --no-renames splits a rename into
// DELETE(old)+ADD(new), so the deleted workflow surfaces; --diff-filter=D lists exactly the deleted paths.
// -z is LOAD-BEARING too (ตู๋ F3, #200): this repo has non-ASCII (Thai) filenames, and git quotes those
// (wraps in "…\340…") in normal output → `startsWith('.github/workflows/')` would see a leading " and MISS
// a deleted Thai-named workflow. -z emits raw NUL-separated paths with NO quoting (also covers spaces/quotes).
//
// Intentional gate removal IS allowed, but must be SPOKEN: the PR body must carry a heading line that is
// EXACTLY '## intentional-workflow-change' on its own line (what gate is going · why · what still bites
// on the lines below). Matched anchored to the line (ตู๋ F4, #200) so pasting this guard's own error text
// — which mentions the marker mid-sentence — can NOT satisfy it. ตู๋ reviews the section.
//
// Inputs (env): BASE_REF (default origin/main) · PR_BODY (the PR description).
// Run: BASE_REF=origin/main PR_BODY="$BODY" npx tsx scripts/guard-workflow-integrity.ts
import { execSync } from 'node:child_process'

export const INTENT_MARKER = '## intentional-workflow-change'
// Anchored to a full line (leading/trailing blanks only) — NOT a loose substring. `^…$` with `im` so the
// marker must be a real heading on its own line, never text embedded in a sentence (e.g. a pasted error).
const INTENT_MARKER_RE = /^##[ \t]+intentional-workflow-change[ \t]*$/im
const WORKFLOW_PREFIX = '.github/workflows/'

/** The exact diff command that surfaces deleted/renamed workflow files. --no-renames AND -z are load-bearing. */
export function deletedWorkflowsCmd(baseRef: string): string {
  return `git diff --name-only --no-renames --diff-filter=D -z ${baseRef}...HEAD`
}

/** Deleted (incl. renamed-away) workflow files vs baseRef, computed from real git history. */
export function deletedWorkflows(baseRef: string): string[] {
  const out = execSync(deletedWorkflowsCmd(baseRef), { encoding: 'utf8' })
  return out
    .split('\0') // -z → NUL-separated, unquoted (handles non-ASCII/space/quote paths verbatim)
    .map((s) => s.trim())
    .filter((p) => p.startsWith(WORKFLOW_PREFIX))
}

/** Pure decision: given deleted workflow paths + PR body, may this PR pass? */
export function evaluate(deleted: string[], prBody: string): { ok: boolean; reason: string } {
  if (deleted.length === 0) return { ok: true, reason: 'no workflow deleted or renamed' }
  if (INTENT_MARKER_RE.test(prBody)) {
    return { ok: true, reason: `intentional: ${deleted.length} workflow(s) removed with '${INTENT_MARKER}' heading in body` }
  }
  return {
    ok: false,
    reason: `${deleted.length} workflow file(s) deleted/renamed without an '${INTENT_MARKER}' heading in the PR body: ${deleted.join(', ')}`,
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
  console.error(`   Removing or renaming a CI gate is deliberate work. If this is intentional, add a heading`)
  console.error(`   line that is exactly "${INTENT_MARKER}" on its own line in the PR body, then say below it`)
  console.error(`   what gate is going, why, and what still bites.`)
  process.exit(1)
}

// Run only when executed directly, so the *.test.ts can import the pure helpers without side effects.
if (import.meta.url === `file://${process.argv[1]}`) main()
