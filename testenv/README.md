# mumate test-env — local FE + BE + bazi stack (agent "มีตา" ทุกหน้า)

A fully-local stack so an agent can boot the 3 apps + a real-shaped DB and capture any `/v2` page
**without ever touching prod** and without anyone hand-assembling backend URL / bazi URL / passkey /
MEMBER_ID. Lives in `mootech-fe/testenv/` (next to `harness/`, the verify-tooling home). Movable later.

## Port map
| service | port | notes |
|---|---|---|
| mootech-fe | **3000** | `npm run dev` |
| mootech-be | **4000** | `PORT=4000 npm run start:dev` (default is 3000 → collides with FE, so forced) |
| bazi | **3100** | `npm run dev -- -p 3100` |
| postgres | **5433** | docker, SSL self-signed, db `mumate_test` |

## Why the local postgres serves SSL (do not remove)
All three apps hard-require an SSL connection to the DB (prod is Supabase, SSL-only):
`mootech-be app.module.ts:79` (`ssl:{rejectUnauthorized:false}`, unconditional), `mootech-fe
lib/db/index.ts:11` (`ssl:'require'`), `bazi src/db/client.ts:28` (`ssl:'require'`). A stock local
postgres would make all three crash at boot with "server does not support SSL connections". We fix it
at the **infra** layer (no app-code change): the compose postgres generates a self-signed cert at start
and runs `ssl=on`; `rejectUnauthorized:false` / `ssl:'require'` accept self-signed. Local-only → safe.

## One shared DB (verified)
ฟีม confirmed 1 DB — bazi was merged into Supabase (Neon kept as backup only; `getDatabaseUrl =
APP_DATABASE_URL ?? DATABASE_URL`, prod sets `APP_DATABASE_URL`=Supabase). All three apps point at the
one local db `mumate_test`. **Proof point in `dump.sh`: it counts bazi-prefixed tables (~58) — 0 = STOP
+ report (prod isn't the merged 1-DB we assumed).**

## Flow
```
1. ฟีม (holds prod cred):
     # type/paste the URL WITHOUT echoing it — keeps the password out of ~/.zsh_history
     read -rs PROD_DATABASE_URL && export PROD_DATABASE_URL     # 'postgresql://…?sslmode=require'
     ./scripts/dump.sh          # schema-only → dumps/schema.sql (refuses if dumps/ isn't gitignored; proves bazi tables)
     unset PROD_DATABASE_URL     # scrub it from the shell when done
2. anyone:                  ./scripts/stack.sh         # guard → postgres(SSL) → restore → swap .env (safe) → boot cmds
3. boot the 3 apps (printed by stack.sh), then Playwright → dev-login → /v2 → capture 393/360/320
4. done testing:            ./scripts/stack.sh restore # put every real .env back from .backups/, drop the markers
```
> Never `export PROD_DATABASE_URL='postgres://user:pass@…'` inline — the password lands in shell
> history. Use `read -rs` (above), and `dumps/`/`.backups/` are gitignored so no prod data or cred
> can be committed.

## Safety (fail-closed, structure not intent)
- `guard.sh` refuses to boot if any DB target matches a prod host (`supabase.*`/`neon.tech`/`render.com`/…),
  and requires local hosts. Run **before** boot **and after** the .env swap (the swap overwrites the real
  `.env`, which holds prod cred).
- `stack.sh` **backs up** each app's real dotfile → `testenv/.backups/<repo><dotfile>.prod.bak` (gitignored)
  BEFORE overwriting, and **never overwrites an existing backup** — so the prod cred is always recoverable.
- **`.env.disabled` marker** (dropped in each repo on swap): a **no-secret** breadcrumb so a confused human
  sees they're in test-mode + how to leave. It holds **no cred** on purpose — writing cred there would
  recreate the old committable-`*.prod.bak` leak class. Kept out of git via each repo's `.git/info/exclude`
  (no committed `.gitignore` change needed in the BE/bazi repos).
- **Interrupted run = no half state:** if `stack.sh` dies mid-swap, an EXIT trap rolls back the swaps it
  already made (real `.env` back, markers removed). On success the swap persists so the apps can boot.
- **`restore` is the way back:** `./scripts/stack.sh restore` returns every real `.env` and removes the
  markers, idempotently.
- **Runtime:** macOS `/bin/bash` is 3.2 (`env bash` resolves to it — no newer bash present). `stack.sh` is
  bash-3.2-safe (no `declare -A`, no empty-array-under-`set -u`) and verified end-to-end under it.
- `env/*.env` are committable — dummy externals only, DB points local. `certs/`, `dumps/`, `.backups/`, and
  the real `.env` are gitignored. `anonymize.sql` scrubs names/emails/phones from restored data while
  keeping dob + birth-time (needed for the fortune compute).

## Manual recovery (if a run was killed and `restore` isn't handy)
Each app's real `.env` is at `testenv/.backups/<repo><dotfile>.prod.bak`. To recover by hand:
```
cp testenv/.backups/mootech-be.env.prod.bak            ~/ghq/github.com/mojisejr/mootech-be/.env
cp testenv/.backups/bazi-sft-dataset.env.local.prod.bak ~/ghq/github.com/mojisejr/bazi-sft-dataset/.env.local
# then delete the leftover marker(s):  rm <repo>/.env.disabled
```
(`mootech-fe` has no backup — its real `.env` was already local, no prod cred to restore.)

## Files
```
docker-compose.yml   postgres:17 · 5433 · named volume · SSL self-signed (generated at start)
env/fe.env be.env bazi.env   committable dummy env; stack.sh copies → each repo's real dotfile
scripts/dump.sh      pg17 pg_dump, cred from $PROD_DATABASE_URL (never stored), schema-only, proves bazi tables
scripts/restore.sh   pg17 psql restore → local
scripts/guard.sh     fail-closed prod-host refusal (before + after)
scripts/stack.sh     [up|restore] orchestrate: guard → up → restore+anonymize → safe .env swap (marker + EXIT-trap rollback) → boot cmds · bash-3.2-safe
```
