# EYE PROOF — shared top-bar (TopBarBell + TopBarAvatar) + service follow-up

**Anchor:** `harness/run-shared-topbar.ts` · **PR:** feat/v2-shared-topbar · **base:** main `a2d7e79`
**FE build under test:** worktree `mootech-fe-wt-shared-topbar` (branch feat/v2-shared-topbar on a2d7e79)
**Ledger:** `harness/bug-ledger.json` → `shared-topbar-extract-no-consumer-drift`

ANCHOR: harness/run-shared-topbar.ts#mut-ignore-href

## Run command
```bash
# dev up on :3012 in the worktree:  V2_PREVIEW_KEY=<from testenv/env/fe.env> next dev -p 3012
# the anchor renders components in node (renderToStaticMarkup) → automatic JSX runtime → harness tsconfig:
CAPTURE_HOST=http://localhost:3012 npx tsx --tsconfig harness/tsconfig.json harness/run-shared-topbar.ts
# home/calendar pixel-identity (before = clean a2d7e79, after = this branch):
CAPTURE_HOST=http://localhost:3012 npx tsx harness/capture-route.ts --route /v2 --user default --viewports 393 --out before|after
CAPTURE_HOST=http://localhost:3012 npx tsx harness/capture-route.ts --route /v2/calendar/2026-07-14 --user default --viewports 393 --out before|after
```

## What changed
ฟีม's 2 follow-ups on the merged service hub (#145):
1. **Typo** — card 7 `ซินเเส` → `ซินแส`. This is a DELIBERATE divergence from Figma **by ฟีม's ruling** (2026-07-29): I flagged the Figma spelling as a suspected typo, ฟีม confirmed the correct word. Recorded in `services.ts` header + the anchor's expected fragment updated.
2. **Shared bell + avatar** — `BellButton`/`AvatarButton` were home-local (3 pages had 3 different bell/avatar implementations). Extracted to `features/v2-shell/components/{TopBarBell,TopBarAvatar,LogoutModal}.tsx`. All 3 pages now use them. **Behaviour is prop-driven (single point of change)**; skin is a `variant` so each page keeps its EXACT current pixels until ฟีม picks one unified look (then it's a one-line variant edit). Default behaviour (ฟีม): service bell → notifications, service avatar → logout menu; home + calendar behaviour unchanged.

## proof-of-teeth (run-shared-topbar.ts → ✅ PASSED, 0 failed)
| invariant | result |
|---|---|
| **polymorphism** bell solid+onClick → `<button>` (cyan, glyph-A, no unread) | ✓ |
| bell solid+hasUnread → unread-dot present | ✓ |
| bell solid+href → `<a>` (Link) href, **NOT** a `<button>` | ✓ (the single point where the bell becomes a nav) |
| **skin** bell mate+href → gradient + lime + glyph-B, `<a>` | ✓ |
| avatar sapphire → `<button>`, sapphire, letter fallback | ✓ |
| avatar mate → decorative `<span aria-hidden>`, **NOT** a `<button>` | ✓ |
| **home** bell is a `<button>` (in-page panel — unchanged) | ✓ |
| **calendar** bell is `<a>` → /v2/calendar/notifications (unchanged) | ✓ |
| **service** bell is `<a>` → /v2/calendar/notifications (new) | ✓ |
| **service** avatar is a `<button>` → click opens the logout confirm (new) | ✓ |
| 🦷 `mut-ignore-href` (bell always `<button>`, ignore href) | ✗ #1b + calendar-link + service-link → CAUGHT |
| 🦷 `mut-ignore-variant` (always solid skin) | ✗ #2-mate (mate skin wrong) while calendar behaviour still ✓ → CAUGHT |

## home + calendar pixel-identity (🔴 the shipped-screen constraint)
Before (clean `a2d7e79`) vs after (this branch), @393, `pixelmatch`:
- **home** — 738 / 3,337,356 px differ (0.022%), **ALL at y 1506→3866** (fortune ring / mascot / sections = live per-render data). **Header region (y<260, where bell+avatar live) = 0 diff** → my change is pixel-identical; the deltas are dynamic content, not the refactor. Home console errors: 2 before AND 2 after (pre-existing noise, unchanged).
- **calendar day** — **0 / 6,133,944 px differ (0.0000%)** → pixel-identical.

## regression — all prior anchors GREEN (no consumer drift)
`run-header-structure` (home) 🟢 · `run-calendar-day` ✅ · `run-calendar-flow` ✅ (bell→notifications reachability intact) · `run-calendar-notifications` ✅ · `run-service-hub` ✅ (12 cards + typo fragment updated).
`tsc --noEmit` ✓ · **prod `next build`** ✓ · **ledger integrity + architecture PASS**.

## adversary sign-off
Cross-oracle, RUN-PROVEN — I do **not** self-certify.
- **ตู๋ — ⏳ PENDING**. Points to attack: (1) did home (shipped) move even 1px? — before/after diff: header 0-diff, the 738 lower-page px are live fortune/mascot (y≥1506), and `run-header-structure` still green; (2) did any bell lose its behaviour? — `mut-ignore-href` bites (calendar+service stop navigating); component-level asserts button-vs-link per call; (3) did the skins collapse? — `mut-ignore-variant` bites (mate skin wrong); (4) is the service avatar→logout real? — clicked it, the confirm dialog opens; (5) is the typo change intentional? — yes, ฟีม-ordered divergence from Figma, recorded in `services.ts` + here.
- **goo** — consumes `useV2Logout` (his action hook) on the service page; no hook/contract changed, only called.

## flags → ฟีม (the ONE open decision I did NOT make)
**Unified look** — the 3 pages still have 2 different skins (home/service = solid cyan bell + sapphire avatar; calendar = mate-gradient bell + gradient decorative avatar). They now share ONE component, so unifying is a one-line `variant` change per page. I did NOT pick the winner (บอง: "อย่าเพิ่งตัดสินเอง — กำลังถามฟีม"). When ฟีม decides, point every call at that variant (or flip the default) — no page is rewritten.
