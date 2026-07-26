# verify-evidence — testenv shadow-before-ignore window (#177 follow-up) · goo

Script-only (`testenv/scripts/stack.sh` reorder + a new `shadow-ignore-order.test.sh`). No runtime, no TS
touched. Proven under `env bash` 3.2.57 (the real runtime), against sandbox git repos — never the live stack.

## the hole (บอง's review lens — caught before any PR-B run)
`stack.sh up()` neutralizes a `next` app's prod `.env*` by **renaming** it to `*.testenv-shadowed`
(`shadow_others`), and separately writes a LOCAL `.git/info/exclude` pattern for that suffix
(`ensure_local_ignore`). On `686fb60` the calls were ordered **shadow first, ignore second**:

```
cp "$tmpl" "$dest"
shadow_others "$dir" "$repo" "$dotfile"   # .env.local → .env.local.testenv-shadowed   (prod secret, new name)
write_breadcrumb "$dir" "$bak"
ensure_local_ignore "$dir"                # only NOW is *.testenv-shadowed added to .git/info/exclude
```

Between those two calls the prod-secret file exists **under a git-commitable name**. `mootech-be/.env.local`
is the strongest file we hold — `SUPABASE_REAL_PRODUCTION_SERVICE_ROLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
`SUPABASE_REAL_DB_PASSWORD`, `RENDER_API_KEY` (RLS-bypassing + infra-controlling). Normally the window is a
blink, but if `stack.sh` dies mid-run (post-copy **guard fail → `exit`**) *and* the rollback trap fails to
un-shadow, the key is left on disk in a name `git` will happily stage. Low probability, unrecoverable if it
fires. บอง confirmed with `git check-ignore .env.local.testenv-shadowed` → **not ignored in all 3 repos**.

## the fix
Move `ensure_local_ignore "$dir"` to run **before** `shadow_others` (and before `write_breadcrumb`). The
design was already right — line 47 writes `*$SHADOW_SUFFIX` and the marker into `.git/info/exclude`; only the
order was swapped. Ordered first, the shadowed prod-secret file (and the `.env.disabled` marker) is **born
already-ignored** → window = ZERO. One-line behavioral change; also added a `STACK_SOURCE_ONLY=1` source-hook
so the functions can be unit-tested without running the stack.

## proof-of-teeth (run LIVE under `env bash` 3.2.57, neg-control-first)
**ANCHOR** `testenv/scripts/shadow-ignore-order.test.sh#shadow-ignore-before-shadow` — `5/5 passed`.
- **Part A — behavioral (the window is real, and the fix closes it):** sandbox git repo with a prod-secret
  `.env.local` (`SUPABASE_REAL_PRODUCTION_SERVICE_ROLE_KEY=…`).
  - *shadow-first (the bug):* after `shadow_others`, `.env.local.testenv-shadowed` exists and
    `git check-ignore -q` returns **not-ignored** → the file is git-COMMITABLE (window reproduced). A late
    `ensure_local_ignore` then does close it (proving the ordering, not the mechanism, is the defect).
  - *ignore-first (the fix):* `ensure_local_ignore` → `shadow_others` → the shadowed file is git-ignored **the
    instant it exists**; the `.env.disabled` marker is pre-ignored too.
- **Part B — structural (guards the real stack.sh):** asserts `stack.sh` calls `ensure_local_ignore` (L212)
  BEFORE `shadow_others` (L214).
- **MUTANT (neg-control):** reorder `stack.sh` back to shadow-before-ignore → Part B flips
  `✗ ORDER REGRESSED` → runner `exit 1` **CAUGHT**; original restored (0 mutant markers remain).
- `env bash -n stack.sh` + `shadow-ignore-order.test.sh` parse under 3.2.57. Existing
  `guard.test.sh` still **12/12** (untouched behavior). No prod repo was mutated — sandbox `mktemp -d` only,
  with `$BK` repointed into the sandbox so `shadow_others`' own backup never writes into a real `.backups/`.

## adversary sign-off
**goo self-adversarial (pre-PR):**
- *"The test hardcodes the call order, so it can't detect a stack.sh reorder."* → Split into Part A
  (behavioral, demonstrates the vulnerability class) + Part B (structural, greps stack.sh's real call-line
  order). The mutant reorder proves Part B is the live guard.
- *"Does the source-hook change runtime behavior?"* → `STACK_SOURCE_ONLY` is unset on every real invocation
  (`up`/`restore`), so the `return 0` line is inert; `bash -n` + a real `guard.test.sh` run confirm no
  regression.
- *"Is `ensure_local_ignore` safe to move earlier?"* → It only touches `$dir/.git/info/exclude`; no
  dependency on `cp`/`shadow`/`breadcrumb`. Moving it first also pre-ignores the marker (bonus, no downside).
- Residual: this closes the *shadowed-file* exposure. The **placed** dotfile (`.env`/`.env.local`, now
  local) relies on each repo's own committed `.gitignore` for `.env*` — unchanged and out of scope here.

**Pending ตู๋ (too)** — บอง will merge on green (script-only, his explicit call); ตู๋ gets it in the
next-milestone lens sweep with #184/#183.

ANCHOR: testenv/scripts/shadow-ignore-order.test.sh#shadow-ignore-before-shadow
