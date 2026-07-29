# EYE PROOF — ดวงสมพงศ์ Slice 1, V3 compatibility UI

**Anchor:** `harness/run-compat-ui.ts` (+ goo's `harness/run-compatibility.ts` for the contract)
**PR:** feat/v2-compat-slice1-ui · **base:** main `a0c3907` (after #147 ก้อน0 + #148 logic + #149 gender)
**Ledger:** `harness/bug-ledger.json` → `compat-ui-v3-gender-and-states`

ANCHOR: harness/run-compat-ui.ts#mut-silent-male

## What this is
The V3 presentation composed over goo's `useCompatibility` (his data-testids preserved → his contract anchor still asserts through my UI). One screen, two states (Figma 480:4549 / 636:18451) + a V3-native friend-select window + the add-friend sheet (636:18533). Slice 1: no result calc.

## Run command
```bash
# dev up on :3016:  V2_PREVIEW_KEY=<from testenv/env/fe.env> next dev -p 3016
CAPTURE_HOST=http://localhost:3016 npx tsx --tsconfig harness/tsconfig.json harness/run-compat-ui.ts
CAPTURE_HOST=http://localhost:3016 HARNESS_HOST=http://localhost:3016 npx tsx harness/run-compatibility.ts  # goo's contract
```

## proof-of-teeth (run-compat-ui.ts → ✅ PASS 14/14 · run-compatibility → ✅ PASS 9/9)
| invariant | result |
|---|---|
| 🔴 **done-cond #13 (REFRAME 3) END-TO-END** | user picks 👩 FEMALE → the create request carries `gender":"FEMALE"` (intercepted POST /member-with-friend, route-fulfilled → no real create). goo proves form→args; this proves **UI→form→request**. |
| #13 no silent MALE | the request has NO `gender=MALE` when the user chose FEMALE |
| gender default is **VISIBLE** | MALE pre-highlighted `aria-pressed=true` (บอง: seen, not a hidden `\|\| MALE` backend default) |
| **2-state** | select a friend (V3-native list, mocked GET) → row 2 fills with the name AND the button flips gray→enabled (`canViewResult`) |
| V3-native select | friend list renders from `MemberWithFriendGetApi` — NOT the v1 modal mounted (ฟีม's ruling); zero v1 edits |
| **disable-not-hide** | 3 connect rows (FB/Invite/Contacts) present + `aria-disabled` + "ยังไม่เปิด" |
| **honest placeholder** | "ดูดวงสมพงศ์ล่าสุด" opens a "เร็วๆ นี้" sheet (not a dead tap); result button is gated + placeholder |
| **no overflow-x** @393/360/320 · **console 0** | ✓ (person1 `/api/user` mocked so the check reflects the UI, not dev's no-BE 500) |
| goo's contract (run-compatibility) | ✅ 9/9 still green over my V3 UI (title/matching-type/gate/redirects/person1-fallback) |
| 🦷 `mut-silent-male` (hardcode gender MALE, ignore the pick) | request shows `gender":"MALE"` though the user chose FEMALE → **CAUGHT** (the exact REFRAME-3 bug) |

**gate = defense-in-depth** (native `disabled` + `aria-disabled` + gray class + onClick guard, all off `canViewResult`) — no single-line mutation breaches it; proven positively by the disabled-while-empty + enabled-after-both checks.

## DELIBERATE divergences from Figma (ฟีม-ordered — like ซินแส #145, recorded not silent)
1. **3 typos CORRECTED** (Figma still shows them): hero `สมพงค์`→`สมพงศ์` · tagline `ความความรัก`→`ความรัก` · sheet title `เพียงเเค่`→`เพียงแค่`.
2. **GENDER selector** (👨/👩) — not in the Figma add-sheet, restored from v1 (modal-add-freind 446–474); REFRAME 3 (gender is a real bazi calc input; locking MALE corrupts female friends silently).
3. **Friend-LIST in the select window** — Figma node 636:17802 has only the form + connect options, no list; ฟีม ordered it added ("เพิ่มสิ่งที่ต้องมี"). Designed in the sheet's V3 language by Lamun.
4. **surname** — not in the Figma form → sent `''` (goo documents in buildCreateFriendArgs).
5. **image upload** — affordance rendered; file→URL wiring needs v1's upload endpoint (not Slice 1) → imageProfile sent `''` (flagged, not a fabricated URL).

## 🔴 rule compliance
`git diff` touches **NO** `pages/matching/**` and **NO** `constants/api/api-user-matching-*` — v1 is REUSED (MemberWithFriendGetApi / MemberWithFriendCreateApi via goo's wrap), never edited. `tsc --noEmit` ✓ · prod build ✓ · ledger integrity + architecture PASS.

## screenshots
`/tmp/compat3/compat-before-select-393.png` (corrected typos + person1 date). Interactive states (friend-list / add-sheet / FEMALE-picked) are exercised + asserted by the anchor.

## adversary sign-off
Cross-oracle, RUN-PROVEN — I do **not** self-certify.
- **ตู๋ — ⏳ PENDING**. Points to attack: (1) does a picked FEMALE really reach the API or just recolour a button? — intercepted the POST, `gender":"FEMALE"` in the body; `mut-silent-male` bites. (2) did the V3 UI break goo's contract? — run-compatibility 9/9 green (testids preserved). (3) is v1 touched? — no `pages/matching`/`api-user-matching` in the diff; select-list reads the v1 GET api, zero edits. (4) 2-state real? — friend select fills row 2 + enables the button. (5) placeholders honest, connect disabled? — all asserted. (6) typos/gender/list — deliberate, ฟีม-ordered, documented here.
- **goo** — owns `useCompatibility` + gender contract (#149, no fallback + his own teeth mut-E/F); I compose + send the chosen value.
