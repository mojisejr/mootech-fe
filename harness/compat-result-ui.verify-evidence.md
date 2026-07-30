# EYE PROOF — ดวงสมพงศ์ Slice 2E-1 · result screen (spine + top of result)

**Anchor:** `harness/run-compat-result.ts` (+ goo's `scripts/compatibility-result.test.ts` for the parse seam)
**PR:** feat/v2-compat-slice2-result · **stacks on** #151 (2D LoadingScreen) + #152 (2C hook) — merge after both
**Ledger:** `harness/bug-ledger.json` → `compat-result-2e1-spine`

ANCHOR: harness/run-compat-result.ts#mut-birth-fake

## What this is
The **reachable spine + top** of the compatibility result screen (Figma 636:18819), composing goo's `useCompatibilityResult` (2C) and reusing the 2D `LoadingScreen`. Per ฟีม's split (2026-07-30): **2E-1** = route + calc button (fire-once) + **D17** loader + header (**D20**) + score card + ภาพรวม — a screen a user genuinely reaches and sees a result on. **2E-2** = รายด้าน (D22) · สี่เสา+ธาตุ · รายคน (D21) · มาสคอต · แท็บ · D26 3-case.

## Flow (my lane, per goo's 2C note)
Picker "ดูผลลัพธ์เลย" → `calculateCompatibility(person1, person2, matchingType)` (⚠️ side-effect: log + quota) → **fires ONCE** (guarded double-tap + `aria-busy` + disabled while calculating) → on `{ok, matchingId}` navigate to `/v2/service/compatibility/result/[matchingId]`; on error **stay on the picker** + surface it (never navigate to a blank result). The result route reads the id via the hook.

## Run command
```bash
# dev up on :3022 WITH the env (or the middleware fails closed to /maintenance):
set -a; . testenv/env/fe.env; set +a; next dev -p 3022
CAPTURE_HOST=http://localhost:3022 npx tsx harness/run-compat-result.ts                 # baseline → 8/8
# tooth: fabricate a birthdate when absent, then re-run → #hide-absent must TRIP:
#   edit HeaderPerson: const birth = formatCompatBirth(...) || '14 มิ.ย. 2500'  → rule-4 check CAUGHT → revert
```
The get-detail endpoint (`/user-matching/detail`) is route-mocked → **no BE, no real side-effect**.

## proof-of-teeth (run-compat-result.ts → ✅ BASELINE 8/8)
| invariant | result |
|---|---|
| **D17** LoadingScreen mounts while calc reads | role=status up during the 700ms-delayed get-detail, then the result replaces it |
| **D20** title = "ผลดวงสมพงศ์" | exact — NOT "รายละเอียดวัน" (the Figma calendar-copy typo) |
| score renders | reuses the shared **ScoreRing** — grade **A** + **82%** from `overall`; "เข้ากันดีมาก" + hearts + emoji |
| ภาพรวม = `overall.ratingText` | via the reused **SectionCard** |
| **rule-4** birth line SHOWS when present | `14 มิ.ย. 2537 · 09:30 น.` (พ.ศ. via `formatCompatBirth`) — carried from the form (goo #152) |
| **rule-4** birth line HIDDEN when absent | count=0 — no fabricated date (direct-link / parked "ล่าสุด" out-of-scope case) |
| honest fallback | malformed / no-pairMatch → `data-state="empty"` + "ยังไม่พบผลลัพธ์", never a spinner/fake |
| console errors = 0 | ✓ |
| 🦷 `mut-birth-fake` (fabricate a date when birthDate absent) | the #hide-absent rule-4 check sees a birth line on the no-birthDate render → **CAUGHT** |

**verify-the-instrument (negative control):** baseline reads clean; the mutant trips **only** `#hide-absent` — the birth-SHOWS check + D17/D20/score/overview/fallback all stay green — so the tooth is isolated to the exact rule-4 invariant.

## REUSE (D24/D25 — borrow, no code dup)
- **ScoreRing** — extracted from `DayScoreCard` to `day-detail/ScoreRing.tsx` (byte-identical markup → the calendar score is unchanged), reused by the compat score card. No new hex (D25).
- **SectionCard** — reused as-is for ภาพรวม.
- **LoadingScreen** — the 2D component, for D17.

## fire-once button (μุน's lane)
The state-machine (guard double-tap · loading · error-stays-on-picker · navigate-only-on-ok) is logic-complete + tsc-typed. Its full browser fire-once proof needs the picker mounted with two people (the run-compat-ui setup) and **rides with 2E-2** (which mounts the picker + dimensions). Flagged, not silently skipped.

## 🔴 rule compliance
`git diff origin/main...HEAD` touches **NO** `pages/matching/**` and **NO** `constants/api/api-user-matching-*` (v1 `UserMatchingGetDetailApi`/`UserMatchingCalculateApi` are imported+called via goo's wrap, never edited). `tsc --noEmit` ✓ · `scripts/*.test.ts` ✓ · ledger-integrity ✓ · architecture ✓ · prod build ✓ (route `/v2/service/compatibility/result/[matchingId]` generates).

## screenshot
`harness/pixel-proof/compat-result-2e1-393.png` (@393) — ‹ ผลดวงสมพงศ์ · two person cards (name + carried birthdate) · ScoreRing A/82% + "เข้ากันดีมาก" + hearts + 💞 · ภาพรวม.

## adversary sign-off
Cross-oracle, RUN-PROVEN — I do **not** self-certify.
- **ตู๋ — ⏳ PENDING.** Points to attack: (1) does the calc button really fire ONCE (side-effect/quota)? — guarded + disabled while calculating; browser fire-once proof flagged for 2E-2. (2) D20 — is the title the calendar typo? — asserted exact "ผลดวงสมพงศ์". (3) rule-4 — does an absent birthDate render a fake date? — `mut-birth-fake` bites; hidden when absent. (4) is the score a new hardcoded ring or the shared one? — ScoreRing extracted, calendar markup unchanged. (5) forbidden paths? — 0 files in pages/matching + api-user-matching.
- **goo** — owns 2C (`useCompatibilityResult` + parse seam #152, his own teeth) + the carry-through of birthDate/time; I compose the presentation over it.
