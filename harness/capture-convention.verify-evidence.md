# verify-evidence — capture convention (harness/capture-route.ts + CAPTURE.md)

Proof that the team capture tool works AND reflects the FE's REAL state — it cannot silently fabricate or
mislead about which build it shows. Meta-tooling evidence: the capability is "any agent captures a real
authed route for design review, PII-safe, with the captured build made unambiguous."

## capability → gate
Before this, capturing a real `/v2` was blocked (creds → ask ฟีม), and a screenshot can lie about "now" — a
stale FE makes an already-fixed bug look live. The tool must: (1) log in PII-safe, (2) capture the 3 widths
Zone 1 got burned on, (3) make the FE build it captured against unambiguous, so an image can't be mistaken
for the present.

## invariant + anchor (`harness/capture-route.ts`)
- login drives `/dev-login` by explicit **user_id, never the real-name quick-picks** → zero PII.
- every run auto-records the FE build: `detectFeBuild()` = lsof :port → serving worktree → git HEAD +
  commits-BEHIND origin/main; a stale FE is flagged in the output and must be copied into evidence.
- the passkey gate check inspects the redirect **Location** (a wrong key ALSO returns 303 → `/v2?gate_error`),
  not just the status.

## proof-of-teeth (run live, neg-control-first)
| case | result |
|---|---|
| live run @ FE `20d3d05` (current) | 9 shots · default/longname/no-dob × 393/360/320 · **0 console errors · 0 overflowX** |
| **negative control (verify-the-instrument)** | SAME tool, FE `d58a6b8` (pre-#110) → fortune card empty/stuck-skeleton; FE `20d3d05` (post-#110) → **"B+ 70%"**. The tool renders the FE's REAL state, it does not fabricate — and the auto-recorded FE hash makes which-state unambiguous (this is exactly what caught the earlier stale-image mistake). |
| wrong passkey | gate rejected via the redirect-Location check (`/v2?gate_error=invalid`) — a status-303-only check would have passed it |
| real-route refine parity | every Zone-1 refine point correct on the real `/v2`: fortune B+70% · **26 กรกฎาคม 2569** (พ.ศ.) · ✓/✗ circle icons · dashed dividers · [อัพเกรด] badge · "ธาตุของคุณคือ ดิน · ดิถีสมดุล" · longname@320 vocab NOT clipped |
| fullPage fixed-element artifact | the mid-image nav bar is a fullPage artifact — a **viewport-only** capture shows the nav correctly at the bottom → NOT an overlap bug; documented so it isn't re-reported |

ANCHOR: harness/capture-route.ts#detectFeBuild

## adversary sign-off
Cross-oracle, RUN-PROVEN — I do NOT self-certify.
- **บอง** opened the captures himself and caught that the first set (07:50) was taken on a **pre-#110 FE** →
  the empty fortune was a stale image, not a live bug. My miss (I reported the finding without checking the
  FE build) → the FE-hash auto-record + the "images expire" rule. บอง verified the CI gate needs real
  evidence and **refused an admin-merge / gate-skip** — this file is the real thing, not filler.
- **the artifact** I suspected as an overlap bug (nav floating mid-page) was proven NOT a bug via a
  viewport-only capture (nav correctly at the bottom) → documented in CAPTURE.md.
- **goo** converged independently on the same FE-hash lesson (merge+verify #110, then the hash idea).

## honest scope / limitations
- Images are NOT committed (gitignored), and an agent / `gh` **cannot upload images to a PR** (web-UI only).
  The PR carries this evidence + the reproduce command; images reach reviewers via session/chat, and a human
  drag-drops them into the PR if wanted (documented in CAPTURE.md).
- FE-build detection is best-effort (localhost `lsof`); a remote target reports "unknown — record manually".
