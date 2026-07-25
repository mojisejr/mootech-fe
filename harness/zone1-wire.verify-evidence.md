# verify-evidence — Zone-1 refine #2 WIRE (goo)

## capability → gates fired
Integration of the persona DATA seam (#103, useHomeFortune → persona) into the greeting COMPOSE
(#104, μุน's V2HomeScreen ElementLine). Fires: seam type-match, source-consistency (text ธาตุ ==
mascot), progressive-enhancement (element before bazi #14 deploys), product-loop (real @393).

## proof-of-teeth
- **seam type-match (tsc 0):** `useHomeFortune().persona.strengthLabel` + `useMascotFromCompute().elementTh`
  compose into μุน's `element: {elementTh: string|null, strengthLabel: string|null}` exactly — any
  future drift between the persona contract, the mascot result, and the ElementInfo prop goes RED here.
- **source-consistency decision:** the ธาตุ TEXT element is bound from the SAME compute/mascot source as
  the character shown (`mascot?.elementTh`), NOT from persona.elementTh — so the text ธาตุ can never
  disagree with the mascot the user sees. strength ← persona (bazi, its only source).
- **progressive-enhancement:** element renders from compute immediately (before bazi #14 deploys →
  persona null → strengthLabel null → μุน's ElementLine drops the "·", shows "ธาตุของคุณคือ ไม้");
  after deploy the band fills in ("…ไม้ · ดิถีอ่อน"). No hard dependency on the bazi deploy to ship.
- **whitespace belt-and-braces:** blank band can't render an orphan "·" — guarded on BOTH sides
  (goo data-side normalizePersona .trim()→null · μุน render-side strengthLabel?.trim()).
- **anchors green (both lenses):** persona data `home-persona-fields` 5/5 + fortune `home-fortune-fields`
  9/9 + routing state-table `returning-result` 6/6 + μุน pixel `run-element-line` (mut-bare-bullet
  CAUGHT, @393 5 states). `tsc` 0 · `npm run build` exit 0.

## real-path (product-loop — the one cell NOT yet closed)
Authed /v2 @393 with REAL data (element + real ดิถี band) is verified only once bazi #14 deploys to
pdf-dev AND we point BAZI_BASE_URL there with a seeded user (creds pending from ฟีม — same blocker as
the fortune screenshot). Until then: component states are pixel-proven (μุน @393) + the integration is
type/build-proven, but the full authed loop is NOT yet eyeballed. Not claiming browser-truth — it's the
tracked pending step.

## scope / follow-up
Wire only (pages/v2/index.tsx). too's noted dedup — `useV2Home` + `useHomeFortune` both fire
`UserGetById` on mount (pre-existing #102) — is a SEPARATE tracked follow-up, deliberately NOT bundled
here to keep the wire low-risk (useV2Home carries too's routing state-table).

## adversary sign-off
**too (static/AST/completeness) — reviewed the wire, 3 finds:**
- **#1 element split-brain (data):** mascot element (mootech-be) vs persona element (bazi) can disagree
  → the band would describe a different element than the text/character shows. UI-consistency choice
  (bind mascot) is correct, but the divergence must not ship silently. ADDRESSED: dev-only console.warn
  in V2HomeRoute when `mascot.elementTh !== persona.elementTh` (persona.elementTh was forwarded precisely
  to enable this cross-check). Long-term: single-source element+mascot from the bazi engine — noted.
- **#2 elementLoading={false} → dead skeleton (real): RESOLVED (A).** μุน (visual-lens owner) chose
  element-resilience: removed the unreachable skeleton branch AND deleted the vacuous `elementLoading`
  prop entirely (Principle 2 — nothing kept dead-defensive). Wire updated to drop `elementLoading={false}`.
  `element` stays REQUIRED on the prop → wire-drift is still a tsc RED at /v2 (proven: dropping the
  element prop → 1 tsc error). Element renders immediately (resilient to bazi latency/outage); band
  fills in progressively via persona.
- **#3 dedup double UserGetById as a separate follow-up:** too STRONGLY AGREES (useV2Home holds the
  routing/loop-safe state-table; bundling risks a route regression). Confirmed: separate atomic PR.

Still PENDING: too's final sign-off after #2's μุน decision + the real-path @393 eyeball (bazi #14
deploy + creds). goo does not self-certify.

ANCHOR: harness/run-element-line.ts#mut-bare-bullet
