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
  no-percent→null. 7/7 green.
- **omission mutant** (drop `grade` from normalize) → anchor RED "MISSING field: grade"; revert → green.
- **state-table (completeness-pass):** hook resolves EVERY outcome (no userId race / UserGetById error /
  incomplete profile / BFF error / timeout / success) to loading=false + fortune(null|data) — no strand.

## adversary sign-off
PENDING — มุน (visual) + too (static) to sneak past. Reciprocal: goo adversaried มุน's verdict→ring
anchor (percent out-of-[0,100] → ring overflow the verdict-anchor misses; empty best/worst → blank chip).
goo does not self-certify.

ANCHOR: scripts/home-fortune-fields.test.ts#fortune-fields-complete-anchor
