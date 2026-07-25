# verify-evidence — Zone-1 refine #2 persona LOGIC (goo)

## capability → gates fired
Cross-service forward (bazi /api/home → BFF → hook) of the greeting "ธาตุของคุณ" data. Fires: path
confirmation (reuse verified BFF), contract-completeness (persona fields), single-round-trip (no extra
bazi compute), anchor+omission-mutant, cross-oracle adversary (มุน visual / too static).

## proof-of-teeth
- **verify-before-act (the whole basis):** mootech-be `/chinese-horoscope` does NOT compute day-master
  strength (grep-confirmed) → strength cannot be wired from the existing home compute; bazi is the only
  source. Copy: Figma "แข็งแรง" is NOT in the engine vocab (ดิถีอ่อนเกินไป/ดิถีอ่อน/ดิถีสมดุล/ดิถีแข็ง/
  ดิถีแข็งเกินไป) → ฟีมเคาะ ground-truth, no map.
- **source (Path A, ฟีมอนุมัติแตะ route):** bazi PR#14 forwards `persona:{elementTh,strengthLabel}` on
  /api/home route-level (same compute as fortune → no drift, zero extra compute; reuses the shared
  elementLabelForSymbol + existing classifyOperatorStrengthScore; no core-engine change).
- **BFF** `pages/api/home-fortune.ts`: reads `data.persona` → `normalizePersona` → `{elementTh,
  strengthLabel} | null`. strengthLabel REQUIRED (bazi sole source; missing/blank/non-string → null →
  line hidden). Graceful on EVERY path: no-person / !r.ok / timeout / catch → `{fortune:null,
  persona:null}` (200, never 5xx).
- **single round-trip:** persona rides the SAME `/api/home-fortune` call as the fortune — `useHomeFortune`
  now returns `{fortune, persona, loading}` (no second bazi compute; Path A's efficiency preserved FE-side).
- **anchor** `scripts/home-persona-fields.test.ts` — home-persona-fields-complete: complete → both fields
  + strengthLabel is real vocab (copy-guard ≠ "แข็งแรง"); strengthLabel missing/blank/non-string → null;
  elementTh degradable to ""; non-object → null. 4/4 green.
- **omission mutant** (blank `strengthLabel` in normalizePersona output) → anchor RED (2 fail); revert → green.
- **no regression:** fortune anchor `home-fortune-fields` still 9/9; `tsc` 0.
- **real-path (pending deploy):** bazi PR#14 must merge → pdf-dev deploy; until then the BFF degrades
  persona → null gracefully (line hidden), so FE ships safe ahead of the forward. After deploy: POST
  <pdf-dev>/api/home → persona present → line renders.

## scope note (seam)
This PR = DATA layer only (BFF + hook + anchor). The greeting compose (V2HomeScreen "ธาตุของคุณ" line
accepting elementTh/strengthLabel/elementLoading) is มุน's #2; the /v2 wire (element ← compute/mascot,
strength ← persona) lands with her compose — kept out of here so V2HomeScreen (shared file) isn't touched.

## adversary sign-off
**too (static/AST/completeness) — SIGNED** (2 rounds, goo did not self-certify):
- whitespace-only strengthLabel `'   '` was truthy → would render a bare "·" (Forbidden Bare Bullet).
  FIXED: `.trim()` before the gate; teeth proven (revert trim → red). [real bug]
- FE copy-guard was a tautology (asserted a value the test fed in) — REMOVED; FE is a transport, not a
  vocab police (an FE allowlist would reimplement bazi's vocab = drift, same reason we never
  reimplement gradeForPercent). too confirmed this architectural boundary.
- bazi copy-guard was tautological (local array) → now imports the real OPERATOR_STRENGTH_CLASS_BANDS
  and asserts the engine config itself; teeth proven (mutate a real band's displayLabel → red).
- copy-slip (#4): resolved — the strength VOCABULARY is bazi's contract, guarded by the bazi anchor
  against the real config; FE trusts it (single-source). If belt-and-suspenders is wanted, a denylist
  of the one Figma word (no drift) is the only non-reimplementing option — ฟีม's call, not added.
- fortune⟹persona coupling (#1): persona is intentionally null-able (bad score → null, never 500s the
  home) so a hard invariant would be wrong; the route is DB-coupled (no unit harness) → integration
  covered by verify-real-path against pdf-dev (valid person → BOTH fortune and persona present).

**Follow-up (noted by too + goo, for the WIRE/combine step — NOT this data PR):** `pages/v2/index.tsx`
calls `useV2Home` + `useHomeFortune` which each fire `UserGetById(userId)` on mount → 2× per load
(pre-existing since #102, not introduced by persona). Fix when wiring: hoist a single user fetch that
feeds routing + fortune + persona.

**มุน (visual)** — pending her greeting compose (ธาตุ line render + real-vocab copy).

ANCHOR: scripts/home-persona-fields.test.ts#home-persona-fields-complete
