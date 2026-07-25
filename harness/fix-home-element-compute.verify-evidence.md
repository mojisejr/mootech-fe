# verify-evidence — fix v2 home ธาตุ row missing on prod (goo)

## capability → gates fired
Prod regression triage: the greeting "ธาตุของคุณ" row (mascot + element text) vanished on /v2 after
#105 merged. Fires: read-the-real-endpoint (not guess), envelope-shape correctness, omission→anchor
tied to the user-facing glyph, defense-in-depth fallback.

## root cause (verified, NOT guessed)
`toComputeSource` (useV2Home) read `chart.detail.dayAbove.element`, but `ChineseHoroscopeGet` returns
`{ data: chart }` and force-casts it to a FLAT `RESPONSE_CHINESE_HOROSCOPE_GET` type — so the `.data`
envelope was invisible to tsc. Reading `chart.detail` on `{ data: {...} }` silently yielded `undefined`
→ day-master element always null → mascot never resolved + `elementTh` null. #104 moved the mascot INTO
`ElementLine` which returns null when `!elementTh` → the whole row (mascot + text) disappeared.
- **Evidence it's the envelope (not the fields):** `pages/my-destiny/index.tsx:191` — a WORKING consumer —
  reads `result.data.summary` / `result.data.detail`. The response type confirms `detail.dayAbove.element`
  and `detail.yearBelow.constellation/id` exist. So only the `.data` unwrap was missing; fields were right.
- Pre-existing since the hook was written (compute-element never resolved on v2 home); #104 turned a
  silent always-fallback into a visible missing row.

## fix
1. **`lib/personalization/compute-source.ts`** (extracted PURE, React-free so it's anchorable): unwrap
   `.data` first (`raw?.data ?? raw` — also handles a pre-unwrapped caller). useV2Home imports it.
2. **wire defense-in-depth** (`pages/v2/index.tsx`): `elementTh: mascot?.elementTh ?? persona?.elementTh`
   — persona.elementTh is the same day-master element from a VERIFIED-LIVE path (goo curled prod:
   persona{elementTh:"ดิน"}). Row still renders if the compute chain is momentarily null.

## proof-of-teeth
- **anchor** `scripts/compute-source.test.ts` (compute-source-envelope-unwrap): a REAL `{ data: {detail:
  {yearBelow, dayAbove:{element:"EARTH"}}} }` chart → toComputeSource → `resolveMascotFromCompute` →
  `elementTh === "ดิน"` (the exact glyph the greeting renders); flat input still works; missing/null → null.
- **omission mutant** (drop the `.data` unwrap) → the EARTH→ดิน case goes RED (2 pass); revert → 3 green.
- **data real-path (goo verified live):** POST prod bazi /api/home → persona{elementTh:"ดิน", strengthLabel
  "ดิถีอ่อนเกินไป"}; BFF /api/home-fortune → same. So the fallback source is proven, not assumed.
- tsc 0 · build 0 · returning-result 6/6 (useV2Home state-table intact) · persona 5/5 · fortune 9/9.

## still to confirm (handed to ฟีม — env, can't verify without prod cred)
Even with this fix, the row needs the compute chain to reach mootech-be + bazi. ฟีม to verify prod Vercel
has `NEXT_PUBLIC_BACKEND_URL` + `BAZI_BASE_URL=https://bazi-sft-dataset.vercel.app`. If the fortune card
renders on prod, the bazi/BFF env is fine and this code fix closes the ธาตุ row.

## adversary sign-off
PENDING — too (static: the envelope-unwrap + fallback) + real authed @393 eyeball post-deploy. No self-certify.

ANCHOR: scripts/compute-source.test.ts#compute-source-envelope-unwrap
