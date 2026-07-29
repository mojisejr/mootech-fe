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

## proof-of-teeth (run-service-hub.ts → ✅ PASSED, 0 failed)
| invariant | result |
|---|---|
| **image slot ACCEPTS src** (done-cond #4) | `src="/probe.png"` → paints `<img src="/probe.png">` (#1a ✓); no src → gray placeholder, **NO `<img>`** (#1b ✓) — a **negative-control pair** |
| exactly **12 cards** @ **393 · 360 · 320** | ✓ each size · **no overflow-x** @ all 3 |
| **12 enumerated vs an INDEPENDENT list** (not services.ts) | href + title match, Figma order — a wrong data edit is CAUGHT, not echoed |
| **reachability — click-walk ALL 12** | 8 → coming-soon `?service=<name>` · ปฏิทิน → /v2/calendar · ร้านค้าของเรา → /v2/shop · Healing Circles/สาคร-map → coming-soon — every card LANDS |
| **บริการ tab active** | `nav a[href="/v2/service"][aria-current=page]` present, labelled บริการ |
| coming-soon | **NAMES the tapped service** · way back → /v2/service · บริการ tab still active |
| 0 app-fetch + 0 console | across the whole walk |
| 🦷 `mut-deadslot` (slot ignores `src`: `src ?`→`false ?`) | **#1a fails** (no `<img>` when src given) while **#1b stays ✓** → CAUGHT, and proves #1a is not vacuously green |
| 🦷 `mut-drop-card` (remove `manifest` from services.ts) | exactly-12 → **found 11** + `service-card-manifest` locator timeout → CAUGHT |
| 🦷 `mut-wrong-dest` (calendar card → coming-soon) | card 9 href ✗ + **click 9 lands `/v2/service/coming-soon?service=ปฏิทิน`** → CAUGHT |

**verify-instrument:** the slot proof is a matched pair (one MUST have `<img>`, the other MUST NOT); mut-deadslot confirmed #1a moves independently of #1b, so the green is real, not vacuous.

## completeness (4 axes enumerated, not spot-checked)
1. **Spatial** — full-page @393 eyeballed: header, all 12 cards incl. the right image-slot column, menubar. `captures/v2-service__default__393.png`.
2. **State-space** — @393 (primary) + @360 + @320 (no overflow); coming-soon state @393 + @320; menu-active state. No data-variants (static catalog); no empty/error/loading (no data).
3. **Reference parity** — 12 cards vs Figma `get_design_context` 12; header (title + อัพเกรด + bell + avatar) matches the frame.
4. **Reachability** — inbound: Menubar บริการ tab → /v2/service (pre-existing, verified). Outbound: all 12 click-walked; the 10 new coming-soon links each NAME the service; coming-soon has a way back. No orphan created.

## real-route artifact @393 (+ overflow @320) + coming-soon
Screenshots (gitignored, `harness/captures/`):
- `v2-service__default__{393,360,320}.png` (+ vp-top/vp-bottom)
- `v2-service-coming-soon__default__{393,320}.png`

`tsc --noEmit` ✓ · **prod `next build`** ✓ (both routes present: `/v2/service`, `/v2/service/coming-soon`) · **ledger integrity PASS** (46 entries).

## adversary sign-off
Cross-oracle, RUN-PROVEN — I do **not** self-certify.
- **ตู๋ — ⏳ PENDING**. Points to attack: (1) are all 12 cards really there + in Figma order? — enumerated vs an **independent** expected list (not services.ts) + count===12 @3 sizes; (2) does every card actually LAND somewhere, or did I assume the hrefs? — **clicked all 12**, asserted the URL each time; `mut-wrong-dest` + `mut-drop-card` bite; (3) is the image slot a real slot or a dead div dressed up? — `mut-deadslot` proves `src` flows to a painted `<img>` (negative-controlled against the no-src case); (4) overflow at 320 with the long Thai titles? — asserted no overflow-x @393/360/320; (5) did I touch home while "borrowing" its header? — **no**: the header is self-contained (home byte-untouched → its anchor green for free); (6) is the coming-soon page honest or does it fake progress? — copy says plainly it isn't open, names the service, has a way back.
- **goo** — no hooks/contract touched; this page is pure UI (no fetch/state/auth beyond the v2 gate).

## flags → ฟีม (surfaced, not silently resolved)
1. **Card 7 text** — Figma reads **"ซินเเส"** (double สระเอ), reproduced verbatim; almost certainly a Figma typo for "ซินแส". Fix the Figma text → `services.ts` follows.
2. **Header tools** — อัพเกรด / bell / avatar are **decorative** this PR (no state on this page). Should the bell link to the existing `/v2/calendar/notifications` screen? (Product call — surfaced per reachability discipline, not silently wired.)
