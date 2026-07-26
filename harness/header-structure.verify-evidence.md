# verify-evidence — Structure A header (ก้อน 2)

Co-located proof for `features/v2-home/components/V2HomeScreen.tsx` (Greeting → Structure A, BellButton,
AvatarButton, NotificationPanel) + `harness/run-header-structure.ts`.

## capability → gate
ฟีม's headline rule: the username must NEVER truncate. @393 the old single-row header left ~84px (6-7 Thai
chars) for the name beside the right cluster → guaranteed cut. Structure A: row1 = "สวัสดีคุณ" as a small
faded LABEL + tools (badge/bell/avatar, no long text so they never squeeze anyone); row2 = the name at FULL
width, bold, wrapping ≤2 lines, never truncated; row3 = ElementLine (unchanged). Plus: avatar image→letter,
badge toggle (goo's boolean), bell → real empty state.

## invariant + anchor (`run-header-structure.ts`)
Render @320/@393: a long name wraps ≤2 lines, full text in the DOM, NOT single-line-clipped, no horizontal
overflow · badge shows on default, hidden when paid (goo's `showUpgrade`; UI never computes the rule) ·
avatar = letter without pictureUrl, image with it · bell tap → panel empty state "ยังไม่มีการแจ้งเตือน".

## proof-of-teeth (run-header-structure.ts, executed)
| case | result |
|---|---|
| name @320 (30-char name) | lines **2** · hClipped **false** · overflowX **false** · fullText **true** → wraps, not truncated ✓ |
| badge toggle | default **shows** (1) · paid **hidden** (0) ✓ |
| avatar | no pictureUrl → **letter** (1) · pictureUrl → **image**, letter gone (0) ✓ |
| bell | tap → panel **"ยังไม่มีการแจ้งเตือน"** ✓ |
| `mut-name-truncate` (re-add single-line truncate @320) | long name clips → no-clip gate rejects → 🦷 CAUGHT |

**verify-the-instrument note**: `vClamped` (scrollHeight>clientHeight) is UNRELIABLE for `-webkit-line-clamp`
(`display:-webkit-box`) — it false-positives even when the name shows fully. So the machine gate uses
hClipped + lines≤2 + fullText; "fully visible, no ellipsis" is proven by the human artifact below.

## real-route capture (บอง's rule: real /v2, NOT home-preview) — FE build `d229da3`
Captured on my FE (:3005) against the REAL test-env backend (BE:4000 · bazi:3100 · pg:5433), fake users:
- **default** @393/360/320 — Structure A: "สวัสดีคุณ" label → "มิลา" headline → "ธาตุของคุณคือ ดิน · ดิถีสมดุล"
  (real compute) · badge shown · avatar letter · fortune B+70% NOT regressed · 0 console errors.
- **longname** @320 — the ~30-char name "มิลาวรรณวิไลอลงกรณ์ศรีสุวรรณภูมิ" wraps to **2 full lines, no
  ellipsis, no overflow** (THE fix, on the real route with real data).
(The mid-page nav bar in a fullPage image is the documented fullPage/fixed-element artifact — not a bug.)

ANCHOR: harness/run-header-structure.ts#mut-name-truncate

## completeness-pass + honest scope
- machine gate @320/@393 · real-route artifact default/longname @393/360/320 · badge/avatar/bell verified.
- **name > 2 lines** → line-clamp caps at 2 (ฟีม's "wrap สูงสุด 2 บรรทัด") — realistic names fit fully; only a
  50-char+ extreme clamps, which is the spec's cap, not the 6-char single-line bug.
- **paid(badge-hidden) + avatar-image on the REAL route need goo's `profile` wire (#179)** — component logic
  verified on home-preview (`?pay=paid` → badge gone · `?pic=y` → image); the real-route capture of those two
  is the JOINT step after goo lands (merge order is #180 → #179). NOT claimed as real-route-verified yet.
- goo's ก้อน 1 fixes (ควรเลี่ยง key, one-call profile) are his PR — not verified here.

## adversary sign-off
Cross-oracle, I do NOT self-certify. Requesting **too** (static + D2) + **goo** (runtime): a name that
overflows despite the wrap; a badge that shows when paid / hides when unpaid (rule-in-UI regression); an
avatar that leaves a broken image on a 404; a bell that taps into silence. **PENDING** run-proven attempts.
