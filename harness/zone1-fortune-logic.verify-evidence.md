# verify-evidence — Zone-1 daily-fortune LOGIC (goo)

## capability → gates fired
Cross-service integration (FE→bazi via BFF) + async data hook + field-completeness. Fires: path
confirmation (real code, not assume), state-table (every outcome graceful), completeness-pass
(enumerate fortune fields), anchor+omission-mutant, cross-oracle adversary (มุน).

## proof-of-teeth
- **path confirmed (reflex, not assumed):** every FE→bazi call proxies via pages/api/* (BAZI_BASE_URL
  server-only, birth-data, CORS) → BFF required. Contract verified from bazi route.ts: request
  {anonId, person}, response {fortune:{percent,verdict,summary,date,dayGanzhi,facets}}.
- **contract gap found + fixed at source:** /api/home dropped grade/summaryHeadline/summaryItems
  (buildManVsDay computes them) → bazi PR#13 forwards them route-level (gradeForPercent single-sourced,
  no engine change). FE normalizes robustly meanwhile.
- **anchor** `scripts/home-fortune-fields.test.ts` — fortune-fields-complete: a complete fortune → ALL
  7 DailyFortune fields populated; summaryItems vs facets fallback; verdict clamp; grade-absent degrade;
  no-percent→null; **pct-bounds** (>100→100, <0→0, NaN→null at source); **empty-facet** (no items + no
  scorable facets → best/worst ""). 9/9 green.
- **omission mutant** (drop `grade` from normalize) → anchor RED "MISSING field: grade"; revert → green.
- **state-table (completeness-pass):** hook resolves EVERY outcome (no userId race / UserGetById error /
  incomplete profile / BFF error / timeout / success) to loading=false + fortune(null|data) — no strand.
- **wire (/v2 index):** V2HomeRoute calls useHomeFortune() → passes {fortune, fortuneLoading} into
  Lamun's presentational V2HomeScreen. tsc 0: my DailyFortune structurally matches her prop shape — any
  future field drift between the two goes RED at the wire (type-level omission→anchor).

## adversary sign-off
SIGNED (data-side seam). Reciprocal loop closed:
- goo → μุน: attacked verdict→ring anchor (percent out-of-[0,100] → ring/label overflow the color-anchor
  misses; empty best/worst → blank chip). μุน closed both run-proven (รู1 clamp once → arc+label;
  รู2 chip fallback '—'), widened `run-fortune-fidelity.ts` to read real glyph — teeth 3/3
  (hardcode-collapse · unclamped-150-rejected · blanked-chip-rejected).
- μุน → goo: DEFENDED goo's BFF verdict-clamp (bad verdict never leaks to ring colour). goo then hardened
  the SAME two failure modes at the DATA source (pct clamp + empty-facet) so a bug dies at both layers,
  not just the render — anchored above (9/9).
- too (static) adversary on the field-anchor: still open (hardcode grade=A pct=99 passes a colour-only
  anchor — the data-binding blind). Covered on the render side by μุน's glyph-read fidelity anchor.

ANCHOR: scripts/home-fortune-fields.test.ts#fortune-fields-complete-anchor
