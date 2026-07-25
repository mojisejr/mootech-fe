# verify-evidence — test-env local stack (goo)

## capability → gates fired
Infra to boot FE+BE+bazi on a local DB for agent capture, with a hard boundary against prod. Fires:
fail-closed guard (the safety invariant), PII/cred leak-surface closure, filesystem side-effect fencing.

## proof-of-teeth
- **guard fail-closed — ANCHOR** `testenv/scripts/guard.test.sh#guard-fail-closed`: 8 cases — every prod
  host (supabase.co/.com, neon.tech, pooler.supabase, onrender.com, rds.amazonaws.com) REFUSED, a
  non-local non-prod-fingerprinted host (`some-random-host.example.com`) ALSO refused (open-by-default is
  the danger), local (localhost/127.0.0.1) ALLOWED. 8/8.
- **mutant (the meaningful one):** the guard is defense-in-depth — dropping a prod pattern doesn't open it
  (the default-deny still catches non-local). So teeth are proven on the DEFAULT-DENY: making
  LOCAL_PATTERNS match everything (open-by-default) → `some-random-host` ALLOWED → anchor RED; revert → 8/8.
- **guard runs before AND after the .env swap** (stack.sh) — the swap overwrites the real `.env` (prod
  cred), so the RESULT is re-verified local, not just the template.
- **PII/cred leak surfaces closed (3, none caught by gitleaks — it hunts keys not birthdates/backups):**
  (1) `dumps/` gitignored + `dump.sh` refuses to write unless `git check-ignore` confirms it (fail-closed,
  not a trusted line) — Phase-2 full.sql = 135 tables of real customer data; (2) README uses `read -rs`
  so the prod URL never enters shell history; (3) stack.sh backs the prod-cred `.env` up into
  `testenv/.backups/` (gitignored) — NOT `.env.prod.bak` loose in each repo (verified NOT ignored in
  mootech-be/mootech-fe → would be committable).
- **SSL is necessary for the whole stack (verified):** BE `app.module.ts:79` (unconditional) + FE
  `lib/db/index.ts:11` + bazi `src/db/client.ts:28` all require SSL → the compose postgres serves a
  self-signed cert; no app-code change. `docker compose config` valid; env scanned — no real secrets.

## NOT claimed (Phase-1 run, needs actual boot)
The 3 apps BOOTING against the local SSL postgres is NOT yet verified (needs the dump + `stack.sh` run):
BE's SSL handshake against the self-signed cert, bazi storage-client init, FE NextAuth. Flagged in-file.
ฟีม runs `dump.sh` (holds prod cred); goo drives the boot after — 🛑 if BE fails with correct env, STOP + report (no BE code change).

## adversary sign-off
PENDING — too (🛡️ prove the guard closes: try to trick it into pointing prod; scan env/anonymize for real
secrets; assess the dev-login.tsx real-user-UUID exposure) + Phase-1 boot run. goo does not self-certify.
(บอง review already closed 2 leak surfaces; goo's own adversary pass found + closed the 3rd — .env.prod.bak.)

ANCHOR: testenv/scripts/guard.test.sh#guard-fail-closed
