# EYE PROOF — ดวงสมพงศ์ Slice 2 · ก้อน 2D · reusable LoadingScreen

**Anchor:** `harness/run-loading-screen.ts`
**PR:** feat/v2-compat-slice2-loading · **base:** main `60a4aca` (after Slice 1 #145–#150)
**Ledger:** `harness/bug-ledger.json` → `loading-screen-2d-reusable`

ANCHOR: harness/run-loading-screen.ts#mut-payment-leak

## What this is
`<LoadingScreen title subtitle />` (`features/v2-shell/components/LoadingScreen.tsx`) — a reusable full-viewport "please wait" surface. Its LOOK is lifted from Figma **375:20499**, which is a **payment-processing** screen; per **D16** the shell takes only the *look* (cloud-sky bg + leaf mascot + centred stack), never that node's payment copy. Built on the existing `FullBleedScreen` container (bg + centred column), so it inherits the responsive contract.

**Zero new assets** (verified source-to-source, not vs the compressed repo file):
- bg = `/images/v2/bg/BG01.png` — `md5 fc9a47ba194e1cc286a90bd7928e6771` is **byte-identical** to node 375:20499's background fill (Figma `download_assets` raw image). BG01 is already the bg of home / service / compat → the loader is visually continuous with the compat screen it covers.
- mascot = `/images/v2/zone4/mascot-leaf.png` — the exact "โปเตโต้" leaf-potato from the node, already shipped + reused elsewhere.

## ฟีม AMEND-1 (2026-07-30) — plan fix, recorded not silent
The FROZEN plan said "2D แยกอิสระ" **and** gave it D17 (mount at the compat calc), which needs goo's 2C — a self-contradiction. I refused to fake a full-screen wait (a timer spinning over nothing = ironclad **rule 4**, "hardcode ค่าหลอกให้จอดูเต็ม") and surfaced it. ฟีม's ruling:
- **2D closes at D16 · D18 · D19** (this PR). Standalone @393 screenshot is the D19 proof.
- **D17 moves to 2E** as a new condition: the result page must mount `<LoadingScreen>` during the *real* calc wait — where the async genuinely exists.

## Run command
```bash
# dev up on :3021:  next dev -p 3021
npx tsx harness/run-loading-screen.ts                    # baseline → 8/8, writes the @393 shot
MUT=payment-leak npx tsx harness/run-loading-screen.ts   # negative control → #no-payment-copy must TRIP
```
The anchor writes + removes its own preview fixture (`pages/_loading-preview.tsx`) — re-runnable, and **ships nothing extra** in `pages/`.

## proof-of-teeth (run-loading-screen.ts → ✅ BASELINE 8/8)
| invariant | result |
|---|---|
| **D16 #no-payment-copy** | rendered text carries NEITHER "ชำระเงิน" NOR "Omise" — only the props passed in + the sr-only fallback. The component source contains no payment string. |
| **D18 role=status** | present (count=1) |
| **D18 aria-live=polite** | present (count=1) → a screen-reader user hears the wait announced on mount |
| title prop renders | "กำลังคำนวณดวงสมพงศ์" (the caller's copy, not a baked constant) |
| **look** — BG01 cloud-sky | actually paints (`img[src*="BG01"]`) |
| **look** — mascot-leaf | actually paints (`img[src*="mascot-leaf"]`) |
| **console errors = 0** | ✓ (no data fetches in this component; a 400 surfaced by this check was a harness-fixture dot-name artifact — diagnosed + fixed to an underscore name, not a component defect) |
| 🦷 `mut-payment-leak` (leak the node's "Omise …" copy into the render) | #no-payment-copy sees "Omise" though the caller passed innocuous copy → **CAUGHT** (the exact D16 bug: payment words riding inside a "reusable" loader) |

**verify-the-instrument (negative control):** #no-payment-copy is only evidence because it CAN fail — known-good (props only) reads clean; known-bad (`mut-payment-leak`) trips, and **nothing else moves** (D18/title/look/console all stay ✓), so the tooth is isolated to the exact invariant.

**motion:** the mascot bob + sparkle twinkle are behind `motion-safe:` only → `prefers-reduced-motion` (and the deterministic @393 capture, `reducedMotion: 'reduce'`) fall back to the static resting pose (translateY(0) / full opacity). Remove-not-pause: the base class is the static frame.

## 🔴 rule compliance
`git diff origin/main...HEAD` touches **NO** `pages/matching/**` and **NO** `constants/api/api-user-matching-*`. No new asset committed. `tsc --noEmit` ✓ · `scripts/*.test.ts` ✓ · ledger-integrity ✓ · architecture ✓ · prod build ✓.

## screenshot
`harness/pixel-proof/loading-2d-393.png` (@393, reducedMotion) — cloud-sky BG01 + sparkle + centred โปเตโต้ + navy title "กำลังคำนวณดวงสมพงศ์" + subtitle "กรุณาอย่าปิดหน้านี้ ระบบกำลังประมวลผล". Matches the Figma **look** (bg + mascot + layout); the payment copy is deliberately absent (D16).

## adversary sign-off
Cross-oracle, RUN-PROVEN — I do **not** self-certify.
- **ตู๋ — ⏳ PENDING.** Points to attack: (1) does any payment word ("ชำระเงิน"/"Omise") survive anywhere in the component or the render? — grep the source + `#no-payment-copy` on the rendered text; `mut-payment-leak` bites. (2) is the a11y real, or just a `<div>`? — `role=status` + `aria-live=polite` asserted on the announced region. (3) is the bg a NEW asset or the real one? — BG01, md5 byte-identical to the node fill, already shipped. (4) did the anchor leave a stray preview route in `pages/`? — fixture removed in `finally`, verified absent. (5) is the motion deterministic? — `motion-safe:` + reducedMotion capture → static base.
- **goo** — owns 2C (the hook + real calc). D17's live mount + its own tooth land in **2E** over goo's contract, per AMEND-1.
