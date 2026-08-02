# EYE PROOF — ดวงสมพงศ์ hero: donut → Figma open ring + avatar fallback (Figma 636:19230 / 636:19061)

**Anchor:** `harness/run-compat-3c.ts` (hero invariants + the fallback assertion + `mut-fake-photo` tooth)
**PR:** feat/v2-compat-donut-avatar-fallback · base = main (`2abe6fe`)
**Ledger:** `harness/bug-ledger.json` → `compat-donut-avatar`

ANCHOR: harness/run-compat-3c.ts#avatar-fallback

## What ฟีม asked (2026-08-03, interactive)
1. โดนัทคะแนน "ยังไม่สวย" → ทำให้ **เป๊ะ** ตาม Figma 636:19230, ดู **เรื่องสี** ด้วย.
2. Avatar **fallback** ตอน user ไม่ได้ใส่รูป — โลโก้ mumate ในวงกลม สวยๆ.
Decisions in-session: fallback = **A (teal-fill)** · donut open-style = **ทุกที่ (all ScoreRing surfaces)**.

## The mismatch (read the node, sampled the pixels — not guessed)
| facet | ของเราเดิม | Figma (sampled) | fix |
|---|---|---|---|
| centre | **ตัน — แผ่นไลม์ disc** + ตัวเลขเนวี่ | **เปิด** (พื้นการ์ดโปร่ง) | ลบ disc |
| grade | navy | **lime #E1FF00** | onDark → lime |
| percent | navy | **white** | onDark → white |
| hero card bg | #0B305B navy (มืดไป) | **Sapphire #1455A4** | `bg-v3-navy` → `bg-v3-sapphire` |
| ring track | #1B3A6B | **#083C7B** | track stroke → #083C7B |

Colours sampled from the Figma nodes with pngjs (center 45,45 = `#1455a4`; track histogram = `#083c7b`;
card-mid 180,230 = `#1455a4`) — recorded so the next reader can re-check, not trust my eye.

## 🔒 Shared-primitive scope (the risk that made me STOP before editing globally)
`ScoreRing` is imported by **5** surfaces: compat hero · calendar `DayScoreCard` · `V2HomeScreen` ·
`useHomeFortune` (+ harness). ฟีม said "เปลี่ยนทุกที่". But calendar bg = pastel gradient
`#E8F1FC→#CBC8FC→#FCE3FA` and home bg = `white→cyan/20` — **light**. A literal "white % everywhere" would make
the % **INVISIBLE** on calendar+home. So "open ring everywhere" is honoured with **bg-adaptive text** (`onDark`):
- dark card (compat hero) → **lime grade + white %**
- light card (calendar/home, DEFAULT) → **navy grade + navy %** (legible)
The old filled disc was self-contained (worked on any bg); removing it forced the text-colour to become a
per-surface token. Same primitive, one prop, no duplication.

## Run command
```bash
set -a; . testenv/env/fe.env; set +a; BAZI_BASE_URL=https://bazi-sft-dataset.vercel.app next dev -p 3098
CAPTURE_HOST=http://localhost:3098 npx tsx harness/run-compat-3c.ts   # 17/17
# tooth: mut-fake-photo (render a real photo when imageProfile absent) → HISTORY rule-4 photo check TRIPS
```

## proof-of-teeth (run-compat-3c.ts → ✅ 17/17)
| invariant | result |
|---|---|
| ScoreRing lives IN the hero (grade shown) | ✓ |
| carried photo shows when imageProfile present | ✓ |
| **rule 4** — NO fabricated real photo from history (no carry) | ✓ (`-photo` absent) |
| **NEW** — avatar FALLBACK shows when no photo (branded, not fabricated) | ✓ (`-avatar-fallback` present) |
| rule 4 — NO birthdate when no carry · name always shows | ✓ |
| mascot illustration shows when an image IS provided | ✓ |
| console errors = 0 | ✓ |
| 🦷 `mut-fake-photo` (render a photo when imageProfile absent) | **HISTORY rule-4 photo check → CAUGHT** |

**Distinct-testid design:** the fallback uses `-avatar-fallback`, NOT `-photo`. So `mut-fake-photo` still trips
on a fabricated *real* photo (the rule-4 tooth is intact), while the fallback is positively asserted separately.
A branded placeholder ≠ inventing user data.

## Pixel proof @393 (real route · real chain fe proxy → bazi prod → prod scenic image)
- `harness/pixel-proof/compat-donut-avatar-after.png` — full result: **sapphire card + open donut (lime A / white 82% / #083C7B track) +
  teal-fill fallback avatars + scenic mascot cards**.
- `harness/pixel-proof/compat-donut-avatar-vs-figma.png` — our hero beside Figma 636:19061 → card colour, donut treatment, cards, avatars match.
- `harness/pixel-proof/compat-donut-ring-3surfaces.png` — the shared ring BEFORE (lime disc) vs AFTER (open) on **navy / calendar-pastel /
  home-white-cyan**: light-bg text stays navy & legible (the negative-control for the shared change).
- `donut-compare.png` — the original coin vs Figma's open ring (the "ยังไม่สวย" root).

## 🚩 still open (surfaced, NOT silently dropped — a different class, out of THIS task's scope)
- **corner element sprites** (ไฟ/น้ำ/ไม้ mini-mascots floating in the sapphire frame) — Figma has them, we
  don't; still pending assets (same A2 as 3C). Logged, not claimed covered.

## 🔴 rule compliance
`git diff origin/main...HEAD` touches **NO** `pages/matching/**`, **NO** `constants/api/api-user-matching-*`.
`tsc --noEmit` ✓ · `scripts/*.test.ts` (52 files) ✓ · ledger-integrity ✓ · run-compat-3c 17/17 ✓.
3 files changed: `ScoreRing.tsx` (shared — open ring + onDark + track colour), `CompatResultHero.tsx`
(sapphire card + onDark + fallback), `run-compat-3c.ts` (fallback assertion) + this evidence + ledger row.

## adversary sign-off
Cross-oracle, RUN-PROVEN — I do **not** self-certify.
- **ตู๋ — ⏳ PENDING.** Attack points: (1) shared-ScoreRing — does the calendar/home ring stay LEGIBLE on
  light bg? white-% regression? → `harness/pixel-proof/compat-donut-ring-3surfaces.png` shows navy text on both light surfaces (onDark default
  false). (2) is the fallback fabricating user data? → no: distinct `-avatar-fallback` testid, `-photo` still
  absent, `mut-fake-photo` still bites. (3) colour "เป๊ะ"? → sampled hex recorded (#1455A4 / #083C7B), not
  eyeballed. (4) forbidden paths? → 0 files. (5) golden rule 6 — the shared ScoreRing edit is INTENTIONAL and
  changes calendar/home too (ฟีม "เปลี่ยนทุกที่") — before/after of both surfaces attached, not hidden.
- **ฟีม** — chose fallback-A + donut-everywhere; the sapphire card (navy→sapphire) is the sampled Figma colour,
  flagged for his eye at merge. **goo** — owns the mascot `imageUrlV2` behind the scenic cards (unchanged here).
