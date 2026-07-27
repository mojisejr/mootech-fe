# verify-evidence — #192: `stack.sh status` reads env by framework precedence, not glob order · goo

Infra/tooling change: `testenv/scripts/stack.sh` (+ a new sibling test). No component / no page / no prod / no
app-env touched. `active_envs` is unchanged. Verified with `bash` (the real invocation path — stack.sh has a
bash shebang), plus a read-only run of the shipped `bash stack.sh status` against the live repos.

## the bug
`do_status` enumerated env files via `active_envs`, which globs `"$dir"/.env*` — **lexicographic** order, where
`.env` sorts BEFORE `.env.local`. It then took the **first occurrence** of each DB key. But a Next app loads
`.env.local` **over** `.env`. So a leftover `.env`=localhost (residue after a `restore`, or a direct boot that
skipped stack.sh's shadowing) made `status` report **🟢 practice** while Next would actually boot on a
`.env.local`=remote. A **false-green in the very tool built to kill false-green** — the same family as the
#167/#176 substring/precedence bugs and today's text-not-match-code run (`.env` header, pixel-anchor docblock,
vp skip line, bug-ledger).

## the fix
New helper `env_load_order(dir, fw)` emits the **active** env files in the **framework's load precedence**
(highest first); `do_status` now iterates it instead of `active_envs`, so "first occurrence wins" yields the
value the app actually loads.
- **next**: `.env.development.local` > `.env.local` > `.env.development` > `.env` — mirrors `mode-banner.mjs`
  `FILES` (NODE_ENV=development, the mode stack.sh boots).
- **node** (NestJS / `@nestjs/config` default): `.env` **only** — it never reads `.env.local`, so applying
  next's precedence to a node app would misreport a file the runtime ignores. `fw` comes from the `APPS` row.
- Matched by **exact base name**, so shadowed (`*.testenv-shadowed`) / marker (`.env.disabled`) / template
  (`.env.example`) files are excluded by construction.
- **Shell-robust**: uses `set --` positional params, not word-splitting of an unquoted string — see the
  adversary note below for why that matters. `active_envs` stays as-is and still feeds the order-independent
  `guard.sh` call.

## proof-of-teeth
Ran `bash testenv/scripts/status-env-precedence.test.sh` — **6/6 passed**:
1. `env_load_order(next)` ranks `.env.local` before `.env`.
2. **AFTER** (precedence read) classifies the connection as `real-unknown` (remote) — what Next loads.
3. **BEFORE** (glob-order read, same fixture) classifies `practice` — reproduces the exact false-green #192 kills.
4. `node` fw reads `.env` only (ignores a present `.env.local`) → `practice`.
5. `node` considers exactly 1 file.
6. shadowed + committed-template files are excluded from the load order.

**End-to-end through the real `do_status`** (temp fixture `.env`=localhost + `.env.local`=supabase, forced under
`bash`):
```
scenario: fakeapp/.env=localhost (residue)  +  .env.local=supabase (what Next actually loads)
BEFORE (glob order, first file=.env):        fakeapp → 🟢 สนามซ้อม (localhost)
AFTER  (fixed do_status, precedence):        fakeapp → 🔴 remote (supabase.co) — project ไม่รู้จัก
```
The green→red flip is the whole point: the tool now names where the app *actually* boots.

**Real shipped command, read-only, on the live repos** — `bash testenv/scripts/stack.sh status`:
```
  • mootech-fe → 🟡 dev (paused project)
  • mootech-be → 🟡 dev (paused project)
  • bazi-sft-dataset → 🟠 Neon (backup DB)
  • docker DB (mumate_testenv_pg): healthy
```
(matches the current restored-to-prod-refs state; no error). Sibling tests intact: `guard.test.sh` 18 passed,
`shadow-ignore-order.test.sh` 5 passed.

## bug-class sweep (#167/#176 precedence/glob trap) — every glob-order env read re-audited from a fresh read
- `do_status` (line ~175): **the bug** — fixed here.
- `shadow_others` (line ~75): moves aside **all** non-placed `.env*` — processes every file, **order-independent**.
  Not vulnerable.
- `guard.sh` call (line ~318): `bash guard.sh $(active_envs …)` — guard is **fail-closed on ANY** file
  (`for target in "$@"` refuses if *any* points at prod). Checking all files is the correct, stricter behavior
  for a gate; order is irrelevant. Not vulnerable.
- `mode-banner.mjs:17` `FILES`: **already** highest-precedence-first — this is the reference the fix copies.
- No `prod-run` subcommand exists (dispatch = `up|restore|status`); `up`'s dump flow reads no env in glob order.
→ `do_status` was the only place that read env in glob order and assumed it was what the app loads.

## adversary sign-off
**goo self-adversarial:**
- **Cross-shell trap (caught live):** my first cut used `for base in $order` (unquoted string). Under `bash`
  (the real path) it word-splits and works — all 6 tests passed. But a debug that *sourced* the script into
  the tool's **zsh** returned nothing (zsh doesn't split unquoted expansions), which would have been a latent
  fragility. Rewrote to `set -- … ; for base in "$@"` so it is correct regardless of the caller's shell/IFS.
- **node vs next:** verified NestJS default loads `.env` only before restricting node to it — did NOT blanket
  next's precedence onto node (that would invent a `.env.local` read the runtime never does).
- **Didn't over-reach:** `active_envs` is untouched, so the fail-closed `guard.sh` path keeps seeing *all*
  files (weakening it to precedence-only would be a security regression — a gate must check everything).
- **Read-only preserved:** `do_status` still only reads; the real-repo run left env SHAs + git state unchanged.
- **No secrets:** the tool prints a verdict + host *family* only, never an env value; the test uses fake hosts.

**Pending ตู๋ (too).**

ANCHOR: testenv/scripts/stack.sh#status-env-precedence
