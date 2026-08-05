# EYE PROOF — ก้อน 0: home bell → full notifications page (modal parked)

**PR:** feat/v2-compat-slice1 (ก้อน 0 of ดวงสมพงศ์ Slice 1) · **base:** main `33ec503`
**Anchors:** `harness/run-header-structure.ts` (home) + `harness/run-shared-topbar.ts`
**Ledger:** `harness/bug-ledger/` → `home-bell-fullpage-not-modal`

ANCHOR: harness/run-shared-topbar.ts#mut-ignore-href

## What changed (ฟีม's ก้อน 0)
ฟีม 2026-07-29: *"เอาหน้าเต็ม แล้วเอา modal เก็บไว้ก่อน เพราะหน้าเต็มคือหน้าที่ design มา."* Home's bell was a
`<button>` opening the in-page `NotificationPanel` modal; now it's the shared `TopBarBell` with `href` → the
FULL `/v2/calendar/notifications` page (same as calendar + service — all 3 bells now go to the full page).
`NotificationPanel` is **PARKED, not deleted** (Rule 1): the function stays in `V2HomeScreen.tsx` with a
comment, unrendered; re-instating the modal is a one-line re-wire. tsc does not enforce `noUnusedLocals`, so
the parked local is clean. The only edit is home; calendar + service were already full-page links (#146).

## Run command
```bash
# dev up on :3014:  V2_PREVIEW_KEY=<from testenv/env/fe.env> next dev -p 3014
HARNESS_HOST=http://localhost:3014 npx tsx harness/run-header-structure.ts
CAPTURE_HOST=http://localhost:3014 npx tsx --tsconfig harness/tsconfig.json harness/run-shared-topbar.ts
```

## proof-of-teeth (✅ both anchors PASS)
| invariant | result |
|---|---|
| home bell is now `<a>` → /v2/calendar/notifications (not a `<button>` opening a modal) | ✓ `run-header-structure` (updated) + `run-shared-topbar` |
| calendar + service bells unchanged (still `<a>` → notifications) | ✓ `run-shared-topbar` |
| home name/badge/avatar structure untouched | ✓ `run-header-structure` (name-no-truncate + badge toggle + avatar fallback all green) |
| 🦷 `mut-name-truncate` (re-add single-line truncate @320) | ✗ long name clips → CAUGHT |
| 🦷 `mut-ignore-href` (TopBarBell ignores href → renders `<button>`) | ✗ home + calendar + service bells stop linking → CAUGHT (now covers home too) |

## 🔴 home is shipped — pixel-identity (region-isolated)
Deterministic `home-preview?state=good&name=มิลา`, before (stashed clean `33ec503`) vs after, @393, `pixelmatch`:
- **Header region (y<260, where the bell lives) = 0 red diff.** First red pixel is at **y=1325** — far below the
  header, in the score-ring/mascot bands (What-If motion = animation-frame variance between two live captures,
  not the refactor). The bell tag change `<button>`→`<a>` renders the **same-pixel** circle+glyph by design
  (shared `TopBarBell` solid skin), and the modal never painted pre-click, so the initial frame is unchanged.
- errors=0 both captures.

`tsc --noEmit` ✓ · ledger integrity + architecture PASS.

## adversary sign-off
Cross-oracle, RUN-PROVEN — I do **not** self-certify.
- **ตู๋ — ⏳ PENDING**. Points to attack: (1) did home move a pixel? — region-isolated diff: header y<260 0-diff, first delta at y=1325 (animation, not the bell); (2) is the bell really a full-page link now? — `run-header-structure` + `run-shared-topbar` both assert `<a>` href=/v2/calendar/notifications; `mut-ignore-href` bites; (3) was NotificationPanel deleted (Rule 1 breach)? — no, it's parked in the file, unrendered, commented; (4) did calendar/service regress? — `run-shared-topbar` all green.
- **goo** — none touched; this is a pure home-UI wire change (no hook/route/contract).

## note
This is **ก้อน 0** of ดวงสมพงศ์ Slice 1 (the independent home-bell piece); the main compatibility screen lands in a follow-up PR once goo's `useCompatibility` contract is ready.
