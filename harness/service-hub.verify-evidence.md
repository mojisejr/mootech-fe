# EYE PROOF — service hub (บริการทั้งหมด, Figma 333:7519)

**Anchor:** `harness/run-service-hub.ts` · **PR:** feat/v2-service-hub · **base:** main `af9dab2`
**FE build under test:** worktree `mootech-fe-wt-service-hub` (branch feat/v2-service-hub on af9dab2, this PR's changes)
**Ledger:** `harness/bug-ledger.json` → `service-hub-12-cards-slot-and-reachability`
`ANCHOR: harness/run-service-hub.ts#mut-deadslot`

## Run command
```bash
# FE up on :3011 in the worktree:  V2_PREVIEW_KEY=<from testenv/env/fe.env> next dev -p 3011
# the anchor renders a component in node (renderToStaticMarkup) → needs the automatic JSX runtime,
# so pass the harness tsconfig (root tsconfig is jsx:preserve):
CAPTURE_HOST=http://localhost:3011 npx tsx --tsconfig harness/tsconfig.json harness/run-service-hub.ts
# screenshots (route-truth, 3 sizes):
CAPTURE_HOST=http://localhost:3011 npx tsx harness/capture-route.ts --route /v2/service --user default --viewports 393,360,320
CAPTURE_HOST=http://localhost:3011 npx tsx harness/capture-route.ts --route "/v2/service/coming-soon?service=มานิเฟส" --user default --viewports 393,320
```

## Result — ✅ PASS (0 failed)
- **slot #1a** src="/probe.png" → paints `<img src="/probe.png">` ✓
- **slot #1b** no src → gray placeholder, NO `<img>` (negative control) ✓
- **@393/360/320** no overflow-x ✓ · **exactly 12 cards** ✓ (each)
- **12 cards enumerated** (independent expected list, not services.ts): href + title match, Figma order ✓
- **menubar บริการ tab active** (aria-current=page) ✓
- **click-walk all 12** land on destination: 8 → coming-soon `?service=<name>`, ปฏิทิน → /v2/calendar, ร้านค้าของเรา → /v2/shop, Healing Circles/สาคร → coming-soon ✓
- **coming-soon** names the tapped service · way back → /v2/service · บริการ tab still active ✓
- **0 app-fetch · console 0** ✓

## Teeth (all demonstrated live — mutate → CAUGHT → revert → green)
| mutant | injected bug | what tripped |
|---|---|---|
| `mut-deadslot` | slot ignores `src` (`src ?` → `false ?`) | ✗ slot #1a (no `<img>` when src given) — while #1b stayed ✓, proving #1a is NOT vacuously green |
| `mut-drop-card` | remove `manifest` from services.ts | ✗ exactly-12 (found 11) + `service-card-manifest` locator timeout |
| `mut-wrong-dest` | calendar card → coming-soon | ✗ card 9 href + ✗ click 9 (`landed: /v2/service/coming-soon?service=ปฏิทิน`) |

**Verify-instrument:** the slot proof is a matched pair (one MUST have `<img>`, the other MUST NOT) — a slot that hardcodes either answer trips one check. mut-deadslot confirmed #1a moves independently of #1b.

## Completeness (4 axes enumerated, not spot-checked)
1. **Spatial** — full-page @393 eyeballed: header, all 12 cards incl. right image-slot column, menubar. `captures/v2-service__default__393.png`.
2. **State-space** — @393 (primary) + @360 + @320 (no overflow); coming-soon state @393 + @320; menu-active state. No data-variants (static catalog) / no empty/error/loading (no data).
3. **Reference parity** — 12 cards vs Figma get_design_context 12; header (title + อัพเกรด + bell + avatar) matches frame.
4. **Reachability** — inbound: Menubar บริการ tab → /v2/service (pre-existing, verified). Outbound: all 12 click-walked; the 10 new coming-soon links each NAME the service; coming-soon has a way back. No orphan created.

## Screenshots (gitignored, harness/captures/)
- `v2-service__default__{393,360,320}.png` (+ vp-top/vp-bottom)
- `v2-service-coming-soon__default__{393,320}.png`

## Flags → ฟีม (surfaced, not silently resolved)
1. **Card 7 text** — Figma reads **"ซินเเส"** (double สระเอ), reproduced verbatim; almost certainly a Figma typo for "ซินแส". Fix the Figma text → `services.ts` follows.
2. **Header tools** — อัพเกรด / bell / avatar are **decorative** this PR (no state on this page). Should the bell link to the existing `/v2/calendar/notifications` screen? (Product call — surfaced per reachability discipline, not silently wired.)
