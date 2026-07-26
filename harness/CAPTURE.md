# Capture Convention — webgang · test-env

The team's standard way to capture a real authed route for design review. Every agent uses this — no more
asking ฟีม for screenshots, and no more "capture blocked by creds" (that friction is fixed at the root here).

> **DRAFT (2026-07-25, Lamun).** The shape below is final; the login selectors in `capture-route.ts` are
> marked `⟨VERIFY⟩` and get confirmed once goo says the test-env stack is booted. Do not treat a capture as
> evidence until the ⟨VERIFY⟩ marks are cleared — **no false-green**.

## Prereqs — the test-env stack (goo boots)
| service | port |
|---|---|
| FE | :3000 |
| BE | :4000 |
| bazi | :3100 |
| postgres | :5433 (PII-stripped, 4,506 real users) |

Passkey = the `V2_PREVIEW_KEY` value in `testenv/env/fe.env` (confirmed from `pages/api/v2/login.ts`) —
**read at runtime, never hardcoded, never logged, never committed.**

> **Point at the RIGHT fe.env.** The passkey must match the `V2_PREVIEW_KEY` of the FE process actually
> serving :3000 — different worktrees have different keys. Set `CAPTURE_ENV_FILE=<that worktree>/testenv/env/fe.env`.
> A wrong key surfaces as `passkey gate rejected (303 → /v2?gate_error=invalid)` (the script checks the
> redirect Location, not just the 303 — a wrong key also returns 303). Find the serving worktree via
> `lsof -p $(lsof -ti tcp:3000 -sTCP:LISTEN) -d cwd`.

_Validated live 2026-07-25 against the test-env (:3000 = wt-z1logic): login + /v2 @393/360/320, 0 errors, no PII._

## One command
```bash
npx tsx harness/capture-route.ts --route /v2 --user default
```
Captures the route at **393 / 360 / 320** (the three widths Zone 1 got burned on) → `harness/captures/`.

### Options
| flag | default | meaning |
|---|---|---|
| `--route <path>` | `/v2` | any authed route |
| `--user <label>` | `default` | `default` · `longname` · `no-dob` (see USERS in the script) |
| `--viewports 393,360,320` | `393,360,320` | override the width set |
| `--out <dir>` | `harness/captures` | output dir (gitignored) |

Login flow the script runs (confirmed from source): `POST /api/v2/login {passkey}` (team gate → `v2_access`
cookie) → `/dev-login` **types `user_id` + `name` into the form** (sets `MEMBER_*` + a `dev` session) →
target route. It drives by **explicit `user_id`, never the real-name quick-picks** — so no real PII is
touched. `name` is display-only (free to override — that's what makes the `longname` case work with any user).

## Output — naming + storage (gitignored)
- Files: `harness/captures/<route-slug>__<user>__<width>.png` — e.g. `v2__longname__320.png`.
- The whole `harness/captures/` dir is **.gitignored**. Screenshots are binaries (and carry PII-shaped
  layouts even when the data is fake) — they do **not** belong in the repo.

## Images expire — always record the FE build hash
A screenshot proves "the build serving :3000 looked like this **THEN**" — never "this is how it is **now**".
If the running FE is behind `main`, a bug that's already fixed will still show in the capture — and reads as
"it's broken" when it isn't. (Real case: a fortune-card capture looked broken; the FE was 1 merge behind the
fix — the image was stale, not the code.) Same shape as absence-vs-unchanged: a point-in-time ≠ the present.

So every capture records the **FE commit hash it was taken against**, in the evidence. `capture-route.ts`
auto-detects and prints it (`🏷️ FE build @capture: <hash> (<worktree>) — N commits BEHIND origin/main`);
copy that line into the evidence. **Before trusting a capture, confirm the FE build is current with `main`**
(or the branch under test) — if it's behind, update + restart the FE and re-capture.

## The three widths — always
393 (primary) · 360 · 320. Zone 1 shipped a bug that only appeared ≤360 (a ground-truth label truncated).
A single @393 capture is **not** "verified" — enumerate the width set (completeness-pass).

## fullPage + a fixed element = a bar floats mid-image (artifact, NOT a bug)
`capture-route` uses `fullPage` (whole page in one image). Playwright renders a `position: fixed` element
(e.g. the bottom tab nav) at its **first-viewport** position, so in a tall stitched image it appears
**mid-content**, not at the bottom — looking like it overlaps a section. It doesn't: in a real 852px viewport
the nav sits correctly at the bottom with content scrolling under it (confirmed by a viewport-only shot).
**Do NOT report the mid-image nav bar as an overlap bug.** If you need to check the nav's true placement,
capture viewport-only (`fullPage: false`) — a separate concern from the full-page content review.

## Different users
`--user` switches the logged-in test user so you can capture the cases that break layout:
- `default` — normal user (dob + gender) → element line + fortune render.
- `longname` — longest display name → header / element-line truncation case.
- `no-dob` — no birth profile → element line hidden / gap-C register redirect.

Add a new case = add an entry to the `USERS` map in `capture-route.ts` (label + how to pick it on
`/dev-login`), so it's reusable, not a one-off.

## How to attach to a PR — all three channels (ฟีม's call)
Screenshots are gitignored, so the PR never **commits** the PNGs. But review needs both a way to *reproduce*
and a way to *see*:

1. **evidence.md + exact command** — for too (a reviewer reproduces, doesn't trust a pasted image). The
   zone's `*.verify-evidence.md` records what the agent saw at each width/user (the completeness-pass) and
   cites the command verbatim: `npx tsx harness/capture-route.ts --route /v2 --user longname`. too/บอง run
   it against the same deterministic test-env → **same pixels**.
2. **images in the PR — for ฟีม/บอง to SEE** (the whole point of the test-env: they view, not run). **Drag-drop
   the PNGs into the PR description/comment** (`gh pr comment` / GitHub UI) — GitHub hosts them on its own
   CDN, **not in git history**. So: visible in the PR, but never a committed binary.
3. **never commit the binary** — `harness/captures/` stays gitignored.

Net: reproduce (too) + see (ฟีม/บอง) + clean repo, all at once. (An agent can also surface the PNGs directly
to ฟีม in-session via the file-send tool — same images, no repo involvement.)

## Relationship to `harness/capture.ts`
`capture.ts` is the low-level **anchor** primitive (one viewport + probes + assets-ready → measurements for
a gate). `capture-route.ts` is the agent-facing **review** capture (login + the 3 widths → screenshots to
eyeball). Both share the assets-ready gate + deviceScaleFactor 2 + overflowX check, so an anchor and a
review-capture see the same final pixels.
