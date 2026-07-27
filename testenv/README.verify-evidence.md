# verify-evidence — testenv/README.md audit (Phase 4) · goo

Docs-only change (`testenv/README.md`). No working code touched. The README had drifted into the 5th
"lying doc" of the week (บอง): 81 lines describing a system half-replaced, with **0** mentions of prod-run,
mode-banner, `stack.sh status`, animation freeze, or the 502 hint. Per บอง, this was a WHOLE-FILE audit
against the real files (not an append, and not written from memory), fixing/deleting stale lines and stating
the gaps — every line below was checked against source.

## proof-of-teeth — each claim reconciled with the real file
**Kept (verified STILL true):**
- SSL refs — `mootech-fe lib/db/index.ts:11 ssl:'require'`, `mootech-be app.module.ts:79
  ssl:{rejectUnauthorized:false}`, `bazi src/db/client.ts:28 ssl:"require"` — all three line numbers still
  accurate (grep'd). Kept.
- Port map, backups, `.env.disabled` marker, EXIT-trap rollback, bash-3.2 note — verified against `stack.sh`.

**Fixed (was stale):**
- `stack.sh [up|restore]` → **`[up|restore|status]`** — real dispatch (`case "${1:-up}" in restore|status|up`).
- "One shared DB": bazi tables **~58 → ~44** — `dump.sh` comment: "real dump 2026-07-26 = 44 … the memory's 58
  was 48+10, now 44 — presence matters, not the count".
- Flow: `stack.sh` (bare) → now describes `up` doing **shadowing (#177)** + guard scanning the whole active set,
  which the old flow ("swap .env") predated.
- Files list: `stack.sh` description updated; added the scripts that exist on disk but were undocumented.

**Added (existed in code, absent from the doc):**
- **Awareness** section — `mode-banner.mjs` (fe `predev`; 🟢/🔴/⚪→STOP, exit-non-zero; verified states + exits in
  source) and `stack.sh status` (reads by framework load-order, #192).
- **Intentional prod access** — `prod-run.mjs` (`node prod-run.mjs [--with-providers] <app> -- <cmd>`; no disk
  write, providers blocked by default, typed confirm, refuses build — all from its header spec) + `prod-probe.mjs`.
- **Capture / verify tooling** — `capture-route.ts` full/vp-top/vp-bottom + fixed/sticky probe (#185/#123),
  `freeze-animation.ts` reducedMotion (#126), and the `backend-hint.ts` 502 hint (#127, flagged as landing).

**Gaps stated explicitly (so no one assumes completeness):**
- predev banner is **fe-only** — verified `mootech-be/package.json` and `bazi-sft-dataset/package.json` have NO
  `predev`/banner wiring. be/bazi awareness is `stack.sh status` only.
- `status` classifies DB + outbound pipe, not every integration; the bash `*.test.sh` run manually, not in CI.

## verified-not-from-memory (บอง's rule)
Everything above cites a real file read this session: `testenv/scripts/{stack.sh,dump.sh,mode-banner.mjs,
prod-run.mjs,prod-probe.mjs,guard.sh}`, the three SSL sources, and both `package.json` files. Nothing was
asserted from recollection of prior conversations. The one forward-reference (the 502 hint) reads the real,
tested file in the PR-#127 worktree and is flagged as landing — see the note in the README + the PR body.

## adversary sign-off
**goo self-adversarial:** did NOT trust the old README OR my own memory of the systems — re-read each source and
kept a claim only when the file confirmed it (the SSL line numbers were re-grep'd, not assumed still-valid) ·
where I could not be certain (the schema-vs-data dump flow) I read `dump.sh` + `stack.sh` restore branch rather
than guess · flagged the single forward-reference (502 hint, PR #127 not yet on main) instead of silently
documenting a feature absent from `main` · stated gaps out loud so the doc doesn't read as "whole system covered".
**Pending ตู๋ (too).**

ANCHOR: testenv/scripts/mode-banner.mjs#awareness-mode-banner
