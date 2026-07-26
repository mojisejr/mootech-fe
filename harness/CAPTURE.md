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

Passkey lives in `testenv/env/fe.env` — **read at runtime, never hardcoded, never logged, never committed.**

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

Login flow the script runs: `POST /api/v2/login {passkey}` → `/dev-login` (pick user) → target route.

## Output — naming + storage (gitignored)
- Files: `harness/captures/<route-slug>__<user>__<width>.png` — e.g. `v2__longname__320.png`.
- The whole `harness/captures/` dir is **.gitignored**. Screenshots are binaries (and carry PII-shaped
  layouts even when the data is fake) — they do **not** belong in the repo.

## The three widths — always
393 (primary) · 360 · 320. Zone 1 shipped a bug that only appeared ≤360 (a ground-truth label truncated).
A single @393 capture is **not** "verified" — enumerate the width set (completeness-pass).

## Different users
`--user` switches the logged-in test user so you can capture the cases that break layout:
- `default` — normal user (dob + gender) → element line + fortune render.
- `longname` — longest display name → header / element-line truncation case.
- `no-dob` — no birth profile → element line hidden / gap-C register redirect.

Add a new case = add an entry to the `USERS` map in `capture-route.ts` (label + how to pick it on
`/dev-login`), so it's reusable, not a one-off.

## How to attach to a PR (so too / บอง can review)
Screenshots are gitignored, so the PR does **not** carry the PNGs. Instead — **reproducibility is the
attachment**, matching the harness/anchor ethos:

1. The capturing agent **Reads its own PNGs**, and records what it saw at each width/user in the zone's
   `*.verify-evidence.md` (the completeness-pass — regions, states, viewports).
2. The evidence cites the **exact capture command**, e.g.
   `npx tsx harness/capture-route.ts --route /v2 --user longname`
3. too / บอง run the same command against the same deterministic test-env → **same pixels**. Reviewer
   reproduces rather than trusts a pasted image.

This keeps the repo clean, avoids shipping PII-shaped binaries, and makes review deterministic.

## Relationship to `harness/capture.ts`
`capture.ts` is the low-level **anchor** primitive (one viewport + probes + assets-ready → measurements for
a gate). `capture-route.ts` is the agent-facing **review** capture (login + the 3 widths → screenshots to
eyeball). Both share the assets-ready gate + deviceScaleFactor 2 + overflowX check, so an anchor and a
review-capture see the same final pixels.
