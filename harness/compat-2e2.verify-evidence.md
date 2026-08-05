# EYE PROOF — ดวงสมพงศ์ 2E-2 · the rest of the result page (Figma 636:18819)

**Anchors:** `harness/run-compat-2e2.ts` (visual) + `scripts/compat-tone.test.ts` (grade→tone, CI-executed)
**PR:** feat/v2-compat-2e2-result-parts · base = main (`c1d61b6`, after 2F+2G merged)
**Ledger:** `harness/bug-ledger/` → `compat-2e2-result` + `compat-tone-13-levels`

ANCHOR: harness/run-compat-2e2.ts#mut-hour-fake
ANCHOR: scripts/compat-tone.test.ts#compat-tone-13-levels

## What this is
2E-1 shipped the reachable SPINE (loader · fallback · header D20 · score · ภาพรวม). 2E-2 wires the rest into `CompatibilityResultScreen`: **รายมิติ (D22)** · **ธาตุ & เสา (D45 ปฏิกิริยาธาตุ + D44 สี่เสา)** · **รายคน (D21 + D46 มาสคอต)** · the **D47 pill tabs**. Six new leaf components (built earlier as new files) + the wiring.

## Key decisions (บอง engine-check + ฟีม ruling)
- **D45 direction** — `aToB` is the headline (บอง: summaryTh composition order + shipped `manvsday.ts:125`); the card features `summaryTh` + shows `aToB.labelTh` as a chip.
- **D22 tone** — no `tone` field in the contract → UI-derived from grade. **ฟีม threshold**: จุดแข็ง = all A (A+/A/A-) + **B+ only**; ต้องดูแล = all D + F; none = all C, B, B-. (B- ≈ 55% isn't a "strength" for a love match.)
- **D47** — a tab appears ONLY for a section with data (ฟีม: "มีก็เอา ไม่มีก็ไม่เอา"); < 2 sections → no tab bar.

## Run command
```bash
set -a; . testenv/env/fe.env; set +a; next dev -p 3027
CAPTURE_HOST=http://localhost:3027 npx tsx harness/run-compat-2e2.ts        # 20/20
npx tsx scripts/compat-tone.test.ts                                        # 6/6 (CI-executed)
# tooth: CompatFourPillarsTable → force hourUnknown=false (render the hour when timeKnown=false) → D23 TRIPS
```
`get-detail` + the mascot API are route-mocked → no BE. `pages/matching` + `api-user-matching` untouched.

## proof-of-teeth
**visual (run-compat-2e2.ts → ✅ 20/20):**
| invariant | result |
|---|---|
| **D47** tab bar shows when 4 sections have data · exactly 4 tabs | ✓ |
| **D22** all 5 love dimension cards render | ✓ |
| **D22 tone END-TO-END** (ฟีม threshold, in the browser) | grades A + B+ → **⭐ จุดแข็ง** (2); D- → **⚠️ ต้องดูแล** (1); C+ / C- → **no badge**. Exactly 3 badges. |
| **D45** ปฏิกิริยาธาตุ renders | ✓ |
| **D44** สี่เสา for both persons | 2 tables |
| **D21** รายคน for both persons · **D46** มาสคอต card | ✓ |
| **D47** tab click sets active (scroll-to-section) | ✓ |
| console errors = 0 | ✓ |
| **COLLEAGUE**: 4 dimension cards | ✓ (love 5 / colleague 4 verbatim) |
| **D23** timeKnown=false → ยาม note present + column shows "—" (not a fabricated pillar) | person B ยาม = `—`, person A = real `壬戌` |
| **minimal** (only overall) → NO tab bar · NO dims/element/people sections · spine present | ✓ |
| 🦷 `mut-hour-fake` (render the hour when timeKnown=false) | **both D23 checks CAUGHT** — the note vanishes and the ยาม column shows a fabricated pillar. |

**pure (scripts/compat-tone.test.ts → ✅ 6/6, CI-executed):** all 13 rating levels (F..A+); the anti-trap invariant (tone consistent within A/C/D; A+/A- get A's badge — the exact silent bug บอง named); the B-family split pinned (B+ strong, B/B- null); the ฟีม mapping. Tooth: reverting `letter==='A'` to exact `g==='A'` trips it.

## 🔬 Shipped-code surgery proof (golden rule 6 — PIXELS, not tsc)
`CompatibilityResultScreen.tsx` is a **shipped** file (2E-1 on main). The wiring is additive, so the proof is: in the **minimal state** (only `overall`, no dims/element/people) the page must render **identically to main** — the tabs render null and nothing new paints.
- Rendered the minimal result @393 BEFORE (`git show origin/main:…` swapped in, HMR recompiled) and AFTER (this branch), same mock, `reducedMotion`.
- `pixelmatch`: **0 / 1339344 = 0.0000% → PIXEL-IDENTICAL** (PNGs byte-identical, md5 `b2ecccff…`).
- Artifacts: `harness/pixel-proof/compat-2e2-min-BEFORE.png` · `…-AFTER.png`.

## D26 — 3-case screenshots @393
`harness/pixel-proof/compat-2e2-love.png` (รัก — 5 dims, tone badges, ธาตุ, สี่เสา, มาสคอต, รายคน) · `…-colleague.png` (เพื่อนร่วมงาน — 4 dims) · `…-notime.png` (ไม่ทราบเวลาเกิด — person B's ยาม = "—" + note). The old pre-threshold preview shot was **discarded** (บอง-confirmed, not mixed in).

## 🔴 rule compliance
`git diff origin/main...HEAD` touches **NO** `pages/matching/**` and **NO** `constants/api/api-user-matching-*`. Modified: `CompatibilityResultScreen.tsx` (the wiring). New: 6 components + `compat-result-parts.ts` + `run-compat-2e2.ts` + `capture-compat-result-min.ts` + `scripts/compat-tone.test.ts` + this evidence + the D26/golden shots. `tsc` ✓ · `scripts/*.test.ts` ✓ · ledger-integrity ✓ · architecture ✓ · build ✓.

## adversary sign-off
Cross-oracle, RUN-PROVEN — I do **not** self-certify.
- **ตู๋ — ⏳ PENDING.** Points to attack: (1) tone threshold — does B+ get a badge and B/B- not, across all 13 levels? — proven end-to-end in the browser (3 badges: A, B+, D-) AND in the 13-level pure test with the anti-trap + B-split guards. (2) D23 — is an unknown hour ever fabricated? — `mut-hour-fake` bites; ยาม = "—" + note. (3) D47 — any empty tab? — tabs computed from section-data; minimal state → no tab bar. (4) surgery on the shipped result screen — moved a pixel of the spine? — 0/1339344 in the minimal state. (5) dims verbatim (love 5 / colleague 4)? — asserted. (6) forbidden paths? — 0 files.
- **goo** — owns the 2C result contract these parts render. **บอง** — resolved D45 direction + confirmed tone is display-derived (no BE), relayed ฟีม's threshold, discarded the stale preview shot.
