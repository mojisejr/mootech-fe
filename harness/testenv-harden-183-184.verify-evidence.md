# verify-evidence — testenv-harden (#184 outbound-neutralize + #183 picture-placeholder + #177 shadow-node) · goo · PR-B

One PR (three parts verify together in one real run — they can't be verified in isolation). Infra layer only —
`testenv/` scripts + env template + the anonymize SQL. **No BE/FE code touched.** Verified on the REAL machine
(mootech-be booted, real mumate_testenv_pg) per บอง — not just sandbox. 🛑 No otp/otp-verify/register-tel/
check-line/payment endpoint was ever fired; no prod touched; no re-dump; snapshot preserved.

## #184 — outbound providers were pointed at LIVE hosts (fake keys, live pipe)
`be.env` used dummy keys but `LINE_HOST=api.line.me`, `SMS_8X8_HOST=sms.8x8.com`, `SUPABASE_PROJECT_URL=
dummy.supabase.co`, `DIFY_API_URL=dify.example.com` — an accidentally-invoked call still LEAVES for the real
provider. guard.sh scanned only DB hosts → declared "safe" while the pipe was live (same blind spot as #177's
DB-only scan). **Fix:** every outbound host → RFC-2606 `.invalid` (DNS-unresolvable); guard.sh refuses any real
provider host (`api.line.me|8x8.com|omise.co|api.sendgrid.com|sendgrid.net`) anywhere in an env file
(whole-file value scan, comments stripped), fail-closed. Omise/SendGrid hardcode their host in the SDK → fake
key is their neutralizer, guard tripwire refuses the real domain if it ever appears.

## #183 — anonymize wiped pictures to '' and MISSED a whole column (213 real URLs)
Old anonymize set user picture cols to `''` (broken v2 avatar) and never touched `member_with_friend.picture_url`,
which kept **213 real external http photo URLs** (residual PII — the silent-miss class the email DO-block exists
for, now on pictures). **Fix:** replace (not wipe) all 5 user-facing picture cols with the LOCAL placeholder
`/images/v2/mascot/01.png` (never external, never empty); reference/engine image tables (card art, mascot,
product, sacred-map) enumerated from `information_schema` and KEPT. In-tx self-verify DO-block: each of the 5
must be 100% the placeholder or the whole anonymize RAISES + rolls back.

## #177 real-machine gap — node app's prod .env.*.local stayed active
`shadow_others` ran `next`-only; the BE is `node`/NestJS (loads ONLY `.env` — no envFilePath in any
`ConfigModule.forRoot`, no dotenv dep). Its prod `.env.dev.local`/`.env.prod.local`/`.env.local` (prod DB pooler
+ api.line.me + 8x8.com + Supabase service-role key) were never shadowed → stayed ACTIVE → the whole-set guard
correctly REFUSED and `up` rolled back fail-closed (the stack couldn't come up). **Fix:** shadow for EVERY app,
not just next — only the neutralized `.env` stays active (a real reduction of the reachable set, not a narrower
guard; บอง's call over making the guard node-aware). `ensure_local_ignore` still runs BEFORE `shadow_others` for
the BE dir (#119 window stays closed).

## proof-of-teeth (raw, neg-control-first)
- **#184 guard** `ANCHOR testenv/scripts/guard.test.sh#guard-fail-closed` — **18/18** under `env bash` 3.2.57.
  Neg-control: real `sms.8x8.com`/`api.line.me`/`api.omise.co`/`api.sendgrid.com` → REFUSED; neutralized
  `.invalid` hosts → allowed; a comment naming a provider → NOT false-refused. Mutant (drop a PROVIDER_PATTERN)
  → real host slips → RED.
- **#184 fail-closed, real machine (no endpoint fired):** `sms.8x8.invalid`, `line.invalid`,
  `dummy.supabase.invalid`, `dify.invalid` → all `NXDOMAIN`; control `api.line.me` → RESOLVES (instrument not
  blind). So an accidental otp/sms/line/payment call dies at DNS before any provider.
- **#183 real DB (mumate_testenv_pg, path ข):** after anonymize — `user.picture_url` 4506/4506 placeholder,
  `share_img_profile_url` 4506/4506, `user_provider.picture_url` 5385/5385, `member_with_friend.picture_url`
  **2032/2032 (was 213 external → 0)**, `use_provider` 0 rows; external URLs = 0 across all 5; both DO-blocks
  passed → COMMIT. `ANCHOR testenv/scripts/anonymize.sql#anonymize-picture-placeholder`.
- **#183 neg-control:** forced one `member_with_friend` row back to `https://real-cdn.example.com/...` → DO-block
  `WARNING member_with_friend.picture_url total=2032 placeholder=2031 external=1` → `RAISE EXCEPTION #183
  INCOMPLETE` → rolled back; DB still 2032/2032 placeholder (atomic, zero damage).
- **placeholder loads (real FE):** `GET http://localhost:3000/images/v2/mascot/01.png` → **200 image/png
  1456325B**. FE booted with `Environments: .env` (Next loaded the placed local `.env`, not the shadowed prod
  `.env.local` — #177 closed on the real machine).
- **BE boot (real, #184 condition):** `PORT=4000 npm run start:dev` → raw log `Found 0 errors` →
  `TypeOrmCoreModule dependencies initialized` → `Nest application successfully started`; `:4000` LISTEN;
  `GET /` → 200; placed `be/.env` = 6 `.invalid` hosts, 0 real providers, `DB_HOST=localhost`.
- **#177 shadow-node, real machine:** `up` shadows all 3 BE prod files, keeps `.env.example`
  (`is_committed_template` covers BE), guard passes, BE boots. The 3 shadowed BE files are `git check-ignore`'d
  (`ANCHOR testenv/scripts/stack.sh#shadow-all-apps-active-set`; #119 order preserved for the BE dir).
- **migration (both directions):** new `restore` on the shadowed state → 4 BE files byte-identical to prod
  (`.env`=583c81, `.env.dev.local`=16467a, `.env.prod.local`=ae3abc, `.env.local`=e3d7be); new `restore` on an
  OLD never-shadowed state (sandbox) → restores `.env` from backup, leaves the untouched prod files, no phantom
  un-shadow. The first `up` attempt's guard-fail exercised the mid-run EXIT-trap rollback on the real machine.
- Regression: `shadow-ignore-order.test.sh` still 5/5 (#119 ordering holds under shadow-all).

## why the sandbox missed it (บอง's ask — 2nd proof of this week's lesson)
#177/#178 were verified only in a sandbox that had **no node app carrying multiple prod `.env.*.local` files**.
A clean-state / single-file sandbox cannot answer a dirty-state question (a node repo with 3 prod env files
sitting beside the placed one). This is the second instance — after yesterday's `bazi` migration bug — that
"tested green on a clean state" ≠ "correct on the real, dirty state." That's why PR-A passed CI yet this real
run still found work: the gap only exists where the sandbox's assumptions don't.

## adversary sign-off
**goo self-adversarial (pre-review):**
- *"Does neutralizing `SUPABASE_PROJECT_URL` to `.invalid` break BE boot?"* → No — `createClient` validates URL
  *shape* only; the BE booted (raw log). Real: NXDOMAIN.
- *"Could the whole-file provider scan false-refuse a comment?"* → Values-only scan (strips `#` lines + inline
  comments); guard.test proves a provider-naming comment passes.
- *"Does shadow-all move the BE service-role file unsafely?"* → It's git-ignored (born-ignored, #119 order) and
  NestJS never loads it; restore un-shadows it byte-identical (gate 4).
- *"Is the #183 sweep scoped so it won't false-flag reference image tables?"* → The DO-block checks only the 5
  curated user-facing columns; card/mascot/product/sacred-map image tables are enumerated and KEPT.
- Residual/limits: full v2 product-loop render (a logged-in user seeing the mascot avatar) is μุน's product-loop
  follow-up — this PR proves the asset resolves (200) + the DB value is the local placeholder; it does not drive
  the browser. `use_provider` is empty today (0 rows) so its column is set structurally, unverifiable by data.

**Pending ตู๋ (too)** — full runtime review this round (not script-only).

ANCHOR: testenv/scripts/guard.test.sh#guard-fail-closed
ANCHOR: testenv/scripts/anonymize.sql#anonymize-picture-placeholder
ANCHOR: testenv/scripts/stack.sh#shadow-all-apps-active-set
