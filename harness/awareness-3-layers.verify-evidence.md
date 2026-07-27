# verify-evidence — 3 layers of awareness (fe scope) · goo

Make the TOOLS say where you are — read from the REAL env on disk, never a doc/memory/marker. Infra/tooling
only: `mode-banner.mjs` (new) + fe `package.json` predev line + `guard.sh` (teach on refuse) + `stack.sh`
(new `status`). **No app logic touched** (L1 edits only the dev-script line). Never prints an env value.
🛑 no prod, no otp/payment, no snapshot delete. Scope: **fe only** (be/bazi deferred — ฟีม approval / pdf-dev).

## the three layers
- **L1 — banner on every `dev`** (`predev` → `mode-banner.mjs`): first line before boot — 🟢 practice
  (localhost) / 🔴 remote-not-practice (host FAMILY only) / ⚪ unknown → **STOP** (exit non-zero, npm aborts
  dev). Deliberately does NOT claim "production" on 🔴 — a supabase host may be prod or the paused dev project;
  `status` makes the finer call. `⚪ can't-verify ≠ safe` → fail-closed like everything else here.
- **L2 — guard teaches on refuse**: replaces the terse `REFUSE … is not local` with why / how (BOTH paths:
  normal `stack.sh up` + intentional `prod-run`) / where-to-read; per-key REFUSE lines masked to host family.
- **L3 — `stack.sh status`** (READ-ONLY): 4 answers from real state, not markers — where each app points, docker
  up?, outbound pipe blocked?, leftover residue.

## proof-of-teeth (real machine, neg-control-first)
- **L1 banner** `ANCHOR testenv/scripts/mode-banner.mjs#awareness-mode-banner`:
  - 🔴 real fe (prod-family `.env.local`) → `DB: supabase.com · backend: onrender.com` — **family only**, no
    full host/creds; exit 0.
  - 🟢 local `.env` (localhost) → practice; exit 0.
  - ⚪ **neg-control A**: no `DATABASE_URL` → white → **exit 1** + how-to-check.
  - ⚪ **neg-control B**: `DATABASE_URL` at an unrecognized host (`some-random-host.example.org`) → white →
    **exit 1** (does NOT assume safe).
  - ⚪ **neg-control C (review round — fail-open closed)**: `localhostsomething.com` → **exit 1** (white/STOP),
    NOT green. Local match is now EXACT (`LOCAL.includes(host)`), not `startsWith` — a host that merely looks
    local but isn't errs to unknown, never to safe (บอง caught the fail-open in an otherwise fail-closed tool).
  - lead word (review round): 🔴 now leads with the CERTAIN fact **"ไม่ใช่สนามซ้อม (remote)"**, not "ของจริง"
    — it never claims "production" (a supabase host may be prod or the paused dev project; over-claiming makes
    false fear now and dilutes the word for real prod). `stack.sh status` makes the finer dev/prod/neon call.
  - **integration**: `npm run dev` with a white result → predev fails → **`next dev` never starts** (:3000 not
    opened). White genuinely stops dev.
- **L2 guard teach** `ANCHOR testenv/scripts/guard.sh#guard-teach-on-refuse`: a prod `DATABASE_URL` (with a real
  password + full pooler host) → prints the why/how/read block with **both paths**, per-key line shows only the
  family (`pooler.supabase`); **leak check = 0** (the password and full host appear nowhere). `guard.test.sh`
  still **18/18** (exit-code contract unchanged). Review round (บอง): guard sees only the host *family* (like
  the banner), so it must NOT claim "production" — reworded to lead **"env นี้ชี้ออกนอกเครื่อง (ไม่ใช่สนามซ้อม)"**
  and point to `stack.sh status` for the dev/prod call (`'production'` appears 0 times). This is the message the
  team hits when they *slip* — the most-trusted moment — so it says only what it knows.
- **L3 status** `ANCHOR testenv/scripts/stack.sh#status-read-only`: on the current real state →
  `fe → 🟡 dev`, `be → 🟡 dev`, `bazi → 🟠 Neon (backup)`, `docker → healthy`, `pipe → 🔴 open`, residue counts.
  Classifies from the DB host **and username** (the project ref lives in the username for the DB_* shape —
  that's why be resolves to dev, not "remote-unknown"). **Read-only proven**: env-file shas + git status
  unchanged before/after a `status` run. `classify_db` unit: no-DB→unknown, localhost→practice,
  unrecognized→unknown. **Leak check = 0**.

## adversary sign-off
**goo self-adversarial:**
- *"Does white really STOP dev, or just print?"* → `predev` exits non-zero → npm aborts before `next dev`;
  proven :3000 never opened. Not advisory — a real gate.
- *"Could the banner mislabel dev as prod and cause false calm/alarm?"* → It never says "production"; 🔴 =
  "remote, not the practice field — check with `status`". The precise dev/prod/neon call is `status`'s job
  (which reads the project ref). Safe-side: any non-local recognized host → 🔴; any *unrecognized* non-local
  host → ⚪ STOP (not silently trusted).
- *"Any env value leak in any of the three?"* → Banner shows only host family; guard masked to family + teach
  block is env-free; status prints only verdicts. Grep leak-checks = 0 across all three.
- *"Is `status` truly read-only?"* → Only reads files + `docker inspect`; env shas + git unchanged, verified.
- Scope/limits (stated): fe only this round; be (ฟีม "notify before touching BE") and bazi (branch `pdf-dev`)
  deferred — not touched. The banner reads CWD `.env*`; for be/bazi later it runs in their repo the same way.

## 🧪 the real metric (NOT ci)
Per the plan, the true test is **มุน using it cold** ("open /v2, shoot at 393") with **zero pre-brief** — if
she's confused, the system (not มุน) is wrong. Do **not** tell her in advance. That test is บอง/ฟีม's to run;
this PR ships the system it tests.

**Pending ตู๋ (too)** — บอง reviews first, then ตู๋.

ANCHOR: testenv/scripts/mode-banner.mjs#awareness-mode-banner
ANCHOR: testenv/scripts/guard.sh#guard-teach-on-refuse
ANCHOR: testenv/scripts/stack.sh#status-read-only
