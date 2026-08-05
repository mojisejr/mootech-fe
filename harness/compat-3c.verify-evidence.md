# EYE PROOF — ดวงสมพงศ์ 3C · หัวจอ BLUE HERO (Figma 636:18819, scope A)

**Anchor:** `harness/run-compat-3c.ts` (+ `run-compat-2e2.ts` still covers the sections/D23/tone)
**PR:** feat/v2-compat-3c-hero · base = main (`7d8d41d`)
**Ledger:** `harness/bug-ledger/` → `compat-3c-hero`

ANCHOR: harness/run-compat-3c.ts#mut-fake-photo

## What this is (D54 · scope A, ฟีม 2026-08-02)
The result page's TOP is rebuilt into ONE navy hero (Figma 636:18819): ScoreRing + tagline + a derived
highlights line + the two people as **mascot cards** (mascot art · real photo overlaid · name · birthdate).
This REPLACES the shipped 2E-1 header chips + the separate gradient score card, and the mascots move OUT of
the รายคน section into the hero.

## D55 — the real design (I read the node myself; บอง's/ฟีม's API crop came back blank)
`get_metadata(636:18819)` returns the frame with NO children (flattened) — which is why their crops were
empty. I rendered the full-res node via Playwright and cropped the top: the header is one integrated blue
frame, not "chips + a separate mascot". Reported before building; ฟีม chose scope A.

## 🔧 INTENTIONAL spine rebuild — what changed on purpose vs what must NOT move (golden rule 6)
บอง's note: this rebuild MUST show a large diff — so here is exactly what is intentional, so no one reads it
as a regression.
- **Intentionally changed (4 files):** `CompatibilityResultScreen.tsx` (hero replaces chips+score card; −81/+47),
  `CompatResultHero.tsx` (new), `compat-result-parts.ts` (+`deriveHeroHighlights`), and the CARRY PIPE
  (`compatibility-result.ts` + `useCompatibilityResult.ts`, see below).
- **Must NOT move — UNTOUCHED section files (git diff = 0):** `CompatDimensionCard` · `CompatFourPillarsTable`
  · `CompatElementInteractionCard` · `CompatPersonDetail` · `ScoreRing` · `SectionCard`. Their source is
  byte-identical → their render is unchanged; only their **position** shifts under the new hero. That is the
  golden-rule-6 proof for an additive/reposition change: the operated cards' code is provably untouched.
- **Documentation shots:** `compat-3c-BEFORE.png` (main: chips + gradient score) vs `compat-3c-AFTER.png`
  (the hero) — same data. The diff is the intended hero; the section cards below are the same components.

## 🔌 Carry-pipe extension (goo's seam — ฟีม-authorized, FLAGGED for goo/ตู๋)
The hero's real person photo needs `imageProfile`, which `CompatResultPerson` lacked. ฟีม confirmed the form
already has it + the sessionStorage carry exists → I extended the carry **additively** (~4 lines, no existing
name/dob/time logic touched): `CarriedBirth += imageProfile` · `rememberCompatPersons` stashes it ·
`applyCarriedBirth` merges it · `CompatResultPerson += imageProfile?`. Opened from history (no pipe) →
undefined → the photo hides, exactly like the birthdate (rule 4). **goo/ตู๋: please review this seam edit.**

## Run command
```bash
set -a; . testenv/env/fe.env; set +a; next dev -p 3028
CAPTURE_HOST=http://localhost:3028 npx tsx harness/run-compat-3c.ts     # 16/16
# tooth: fall back to a photo when imageProfile is absent → the HISTORY rule-4 photo check TRIPS → revert
```

## proof-of-teeth (run-compat-3c.ts → ✅ 16/16)
| invariant | result |
|---|---|
| hero renders (one navy frame) | ✓ |
| ScoreRing lives IN the hero (grade shown) | ✓ (no separate gradient card) |
| tagline = `overall.gradeLabel` | ✓ |
| **highlights DERIVED** — จุดแข็ง = best dim %, จุดที่ต้องดูแล = worst dim % | `จุดแข็งอยู่ที่ คู่บุญ (70%) · จุดที่ต้องดูแลคือ ความใกล้ชิดทางกาย (38%)` from the dimensions, not fabricated |
| both people in the hero (names) | ✓ |
| carried photo shows · birthdate shows (when carried) | ✓ |
| **rule 4** — NO mascot illustration until goo's image arrives | ✓ (hidden, not a placeholder) |
| **rule 4** — HISTORY (no carry): NO photo, NO birthdate, name still shows | ✓ |
| mascot illustration shows when an image IS provided | ✓ (layout accepts goo's future `imageUrlV2`) |
| sections still render below (dims/element/people) · console 0 | ✓ |
| 🦷 `mut-fake-photo` (render a photo when imageProfile absent) | **HISTORY rule-4 photo check → CAUGHT** |

## ✅ RESOLVED — ฟีม decision (2026-08-02)
- **hearts + emoji CUT** (2E-1's gradient score card rendered them; the Figma hero has no place for them).
  ฟีม ruled: **match the Figma first → keep them cut.** Recorded as a DECISION, not a silent drop — this is
  the important one because it is a **SHIPPED element being removed** (the same bug-class as the Slice-1 gender
  field: something that already rendered quietly disappearing). It was flagged, escalated to ฟีม by บอง, and
  ruled — not dropped blind.

### 🔎 shipped-removal audit (what the 2E-1 result screen rendered that the 3C hero does NOT)
Enumerated the old `CompatibilityResultScreen` render vs the new hero, so nothing vanishes unflagged:
| old (main) rendered | 3C hero | verdict |
|---|---|---|
| header chip: name + birthdate | hero: name + birthdate | PRESERVED (moved) |
| score card: ScoreRing + gradeLabel | hero: ScoreRing + gradeLabel | PRESERVED |
| score card: **hearts + emoji** | — | **REMOVED — ฟีม-ruled (above)** |
| name-absent fallback "—" | roleLabel "คุณ"/"เขา" | changed fallback (role label, not a fabricated name) — minor, noted |
| white ภาพรวม · dims · element · people | unchanged (same components) | PRESERVED |
| CompatMascotCard (white cards, รายคน) | hero mascot illustration | MOVED (now unused component — kept, not deleted) |
**Only hearts + emoji is a true shipped-removal; everything else is preserved or moved. No other silent drop.**

## 🚩 still open — the OTHER flags (these are NEW things never shipped, a different class from the above)
- **highlights lead sentence** (Figma "คู่นี้ไม่ได้ราบรื่น…") — no contract field → **omitted** (rule 4); only the derivable best/worst shown.
- **corner element sprites** — decorative, no assets → **omitted** pending assets.
- **name label** = `displayName` (real data). Figma shows "โปเตโต้" for the friend which may be a mascot name — confirm if ฟีม wants `mascot.nameTh` instead.

## D26 — 3-case screenshots @393 (real ships-now state: photo carried, mascot image pending goo)
`compat-3c-love.png` (รัก) · `compat-3c-colleague.png` (เพื่อนร่วมงาน) · `compat-3c-notime.png` (ไม่ทราบเวลาเกิด — B's ยาม "—"). Plus `compat-3c-hero-withimg-MOCK.png` = the hero WITH a mock mascot image, proving the layout accepts goo's images (clearly a MOCK). The pre-tone-threshold 2E-2 preview shot stays deleted.

## 🔴 rule compliance
`git diff origin/main...HEAD` touches **NO** `pages/matching/**` and **NO** `constants/api/api-user-matching-*`. `tsc` ✓ · `scripts/*.test.ts` ✓ · ledger-integrity ✓ · architecture ✓ · build ✓. `run-compat-2e2.ts` updated (2 assertions repointed to the hero) — still green, `mut-hour-fake` intact.

## adversary sign-off
Cross-oracle, RUN-PROVEN — I do **not** self-certify.
- **ตู๋ — ⏳ PENDING.** Attack points: (1) the carry-pipe seam edit — additive only? does name/dob/time still work? — yes, only `imageProfile` added; the 2E-2 birthdate anchor still green. (2) rule 4 — is a photo/mascot ever fabricated when absent? — `mut-fake-photo` bites; history → no photo, no birthdate. (3) golden rule 6 — did a section card change? — the 6 section-component files are git-diff-0; the hero is the intended change. (4) highlights derived, not a hidden field? — `deriveHeroHighlights` from dimensions. (5) forbidden paths? — 0 files.
- **goo** — owns the carry pipe (I extended it with ฟีม's OK — please review) + the mascot `imageUrlV2` (3B, pending) that fills the illustration. **บอง** — routed the D55 recon + relayed ฟีม's scope-A ruling. **ฟีม** — chose A, authorized the carry edit.
