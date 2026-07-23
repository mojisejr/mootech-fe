# verify-evidence — slice-2 v2 home LOGIC (goo) · returning→home (parity gap C)

## capability → gates fired
Client-state routing + async side-effect (auth/routing/gate + API fetch). Fires: runtime edge-matrix
(state × outcome) · loop-safety (settled-authed only) · screenshot @393 (real-path) · negative-control
(omission mutant) · cross-oracle adversary (too). No product-schema/build gate beyond tsc + hard-gate.

## proof-of-teeth
- **anchor** `e2e/v2-returning-lands-home.spec.ts` — returning(has-chart)→HOME · no-chart→register ·
  stale(is_refresh)→register. 6/6 green (incl. 3 error-state cases).
- **omission negative-control**: an "always-register" mutant (reinstating the slice-1 omission) turns
  the returning→home case RED; revert → green. Proves the anchor pins the gap-C path, not vacuous.
- **real-path @393 screenshot**: returning user lands HOME, greeting "สวัสดีคุณเกวลิน", and the REAL
  per-user character resolves ({PIG,WOOD}→`12_กุน-ไม้.png`) with consoleErr=0 — not the 01.png fallback.
  Two bugs typecheck missed, caught by the screenshot: mascot GET→ComputeMascotSource mapping (raw
  response has no `enrichment`; day-stem lifted) + missing-file fallback (onError→01.png).
- **hard-gate self-catch**: the complete-by-construction transitive ban caught useV2Home wrapping
  useV2AuthGate outside pages/v2 → refactored to useV2Home(status). verify-architecture green.

## adversary sign-off
**too** (static/state lens) attacked the anchor and found the error-state holes goo under-mapped —
resolveHome had no try-catch and treated any missing result_code as no-chart, so (1) a UserGetById
error mis-routed a RETURNING user to register, and (2) a ChineseHoroscopeGet throw left phase stuck at
'resolving' → infinite loading. goo fixed the full state-table (UserGetById error distinguished from
no-chart via user_id presence → home+fallback; every outcome resolves; never a forever-spinner). too's
3 adversary tests re-pointed to assert the fixed behavior; 6/6 green. **too result: survived — signed
off** ("ปิดจ๊อบสวยงาม 6/6"). goo did not self-certify. Lamun's bg-continuity anchor was adversaried
back by goo (single-column-sampling hole, run-proven) — the reciprocal seam.

ANCHOR: e2e/v2-returning-lands-home.spec.ts#returning-lands-home-anchor
