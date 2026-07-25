# verify-evidence — greeting element line (contract #2)

Co-located proof for `features/v2-home/components/V2HomeScreen.tsx` (Greeting → ElementLine) +
`harness/run-element-line.ts`.

## capability → gate
The greeting's "ธาตุของคุณคือ …" line is DATA-driven and PROGRESSIVE — element (from compute) can be
present while the ดิถี band (from persona) is not yet computed (before bazi #14 deploy). The line must
enhance gracefully: show the element alone, add "· {ดิถี}" when the band lands, and NEVER paint an orphan
"·". A whitespace-only band (`" "`) is truthy — a naive check leaks a bare "· ". Ground-truth = rendered glyphs.

## invariant + anchor (`run-element-line.ts`)
Read the rendered element-line text across states: has-band → "· {ดิถี}" present; no-band → "·" dropped;
blank " " band → "·" dropped (trim-guard); no-data → row hidden (element-line absent, no orphan mascot).

## proof-of-teeth (run-element-line.ts, executed, neg-control-first)
| case | result |
|---|---|
| full (band) | `ธาตุของคุณคือ ไม้ · ดิถีอ่อน` → bullet + ดิถี present ✓ |
| partial (no band) | `ธาตุของคุณคือ ไม้` → bullet dropped ✓ |
| blankband (" " band) | `ธาตุของคุณคือ ไม้` → NO orphan bullet (trim-guard, neg-control) ✓ |
| none (no data) | element-line absent → row hidden ✓ |
| `mut-bare-bullet` (inject the "· " a naive truthy-check emits) | orphan "·" flagged → 🦷 CAUGHT |

## completeness-pass (state-space @393, overflowX=false each)
`full · partial · loading (skeleton) · none (hidden) · blankband` — enumerated + rendered (DOM + pixel).
**Forcing-question answered**: other viewports (320/430) = A2 (multi-viewport); the line is single-row
truncate. Real-route render (goo's `useHomeElement` wire) = pending goo's authed capture, covered by
composition (goo data-source × my component × tsc shape) — same as Zone 1's real-route cell.

ANCHOR: harness/run-element-line.ts#mut-bare-bullet

## adversary sign-off
Cross-oracle, I do NOT self-certify. The whitespace-band facet came FROM the seam: **too** caught a
bare-bullet / whitespace hole in the persona anchor; **goo** closed it at the data layer and flagged it
as relevant to this ElementLine ("band ที่เป็น space จะไม่หลุดมาเป็น ' · '"). Cross-lens division:
**goo** = strengthLabel never whitespace at source (data) · **me** = trim-guard + null-hide + orphan-"·"
gate (visual). Requesting goo/too run-proven attempts on the wired `/v2` once this lands + he wires.

## honest scope
Presentational half only. goo wires `useHomeElement()` at `/v2`
(`element={{ elementTh: mascot.elementTh, strengthLabel: persona?.strengthLabel ?? null }}`).
Copy vocab = ground-truth ดิถี (ฟีม 2026-07-25). Multi-viewport + real-route pixel-parity = A2.
