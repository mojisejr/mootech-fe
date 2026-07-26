# verify-evidence — Zone 2 mascot/manifest card

Co-located proof for `features/v2-home/components/V2HomeScreen.tsx` (ManifestCard, ManifestMascot,
ELEMENT_GRADIENTS) + `harness/run-zone2-card.ts`. Figma 588:12969.

## capability → gate
ดวง → มาสคอต → ธาตุ → สีพื้น (ฟีม). The card's gradient is driven by the user's real element and the mascot
comes from the chart. Risks: (1) an unmapped/null element leaves the card colourless; (2) one of the 60
varied mascots (fat/winged) visually covers the title/button; (3) missing data breaks the card. Ground-truth
= rendered pixels + computed style + z-order.

## proof-of-teeth (run-zone2-card.ts, executed)
| case | result |
|---|---|
| gradient by element | ไม้ ✓ · ไฟ ✓ · ดิน ✓ · ทอง ✓ · น้ำ ✓ — each card bg matches ELEMENT_GRADIENTS |
| occlusion | button/title z-10 **> mascot z-1** (renders on top) AND button clickable (mascot pointer-events-none passes the tap through) — checked with the **winged rooster** |
| graceful | element null → **wood** gradient (never colourless) · mascot 404 → **hero 01.png** |
| `mut-button-behind` (content z-0 < mascot z-1) | content no longer on top → occlusion gate rejects → 🦷 CAUGHT |

**verify-the-instrument**: `elementFromPoint` CANNOT measure this occlusion — the mascot is `pointer-events-none`
(so a tap passes through, by design), which makes it invisible to hit-testing; the visual "on top" guarantee
is **z-order**, so the gate compares z-index (and the teeth swaps it). Clickability is the separate hit-test.

## real-route capture (capture-route, auto-hash) — FE build `b2a8df1`
- **real /v2 · default** @393 — the card renders with the user's REAL element **ดิน → earth gradient** + REAL
  mascot (earth rat), the full ดวง→ธาตุ→สีพื้น chain on real data. Zone 1 not regressed. 0 console errors.
- **5 elements** (ไม้/ไฟ/ดิน/ทอง/น้ำ) @393/360/320 via `home-preview?element=…` (`--no-user`, auto-hash) — the
  gradients + occlusion across varied mascots (rat/dragon/ox/rooster/snake). no-data (@393): null→wood, 404→hero.

ANCHOR: harness/run-zone2-card.ts#mut-button-behind

## completeness-pass + honest scope
- 5 elements × 393/360/320 (home-preview, deterministic) + no-data · real /v2 = 2 real elements (default ดิน;
  longname น้ำ). The other 3 elements have **no fake user** (element is dob-derived, not queryable) → forced via
  home-preview. capture-route `--no-user` records the build hash on those too (per the standing rule).
- ⚠️ **The 4 element colours (ไฟ/ดิน/ทอง/น้ำ) are Lamun's PROPOSAL, NOT final — awaiting ฟีม's decision.** ไม้ is
  Figma-exact (locked). All five live in ONE map (`ELEMENT_GRADIENTS`) so ฟีม can swap without a rebuild.
  Captures of all 5 are attached for ฟีม to choose/adjust from the real render.
- coin: 2s float loop with a `prefers-reduced-motion` guard (animation:none under reduce).
- button destination NOT wired (ฟีม). spelling ปรารถนา (Figma's ปราถนา is a typo).

## adversary sign-off
Cross-oracle, I do NOT self-certify. Requesting **too** (static + D2) + **goo** (runtime): a mascot shape that
covers the title despite z-order; an element string the map doesn't cover (→ must fall to wood); the coin
animation ignoring reduced-motion; the button unreadable on any of the 5 gradients. **PENDING** run-proven.
