# verify-evidence — #167 close the `as RESPONSE_*` blind-cast bug-class (goo · [task:167])

The danger: `return response as RESPONSE_*` makes tsc TRUST a shape nobody verified, hiding drift — the
same lie that ate the v2-home ธาตุ element. Closed by PROVABILITY (approach ข), split A/B:

## A — endpoint we can hit (chinese-horoscope-get, read-only GET): typed from the REAL live shape
- **Live shape proof (data-verify standard: endpoint + raw response + commit):** `GET /api/chinese-horoscope?userId=<default>&code=<code>` on the local stack (FE :3001 @ working-tree over 061ba5c · BE @ 14c4b4f) → `{ data: chart }`, inner **15 keys**: dob, time, name, gender, dobThai, yearOfZodiac, summary, cycleLife, cycleYearLife, detail, analytic, power, elementCycle, code, share_profile_url. `share_profile_url` = string; `power`/`analytic.life` = objects present; `summary.element` = "EARTH"; `detail.dayAbove.element` = "EARTH".
- **RESPONSE_CHINESE_HOROSCOPE_GET was deeply WRONG** — declared `analytic.habits_behaviors` (does NOT exist in the response) and omitted 7 real top keys incl. `power`/`analytic.life`/`share_profile_url`, exactly the fields `pages/my-destiny` reads. Rewrote the type to the verified 15 keys (leaf shapes not fully inspected → `unknown`, honest); deleted the fabricated `habits_behaviors`.
- **my-destiny: 0 edits needed** (compiles against the real fields now) **+ renders live** — capture-route `--route /my-destiny --user default` on :3001, `🏷️ FE build @capture: 061ba5c`, full page renders (character + element bars + analytic.life/work + life-path). Type-only change is runtime-inert; my-destiny code is unchanged by this PR. (4 pre-existing console errors, not from this PR.)

## B — endpoints we CANNOT verify (side effects — #184): honest loose type, never fired
`calculate` (saves a chart), `compatibility-love`/`work` (insertLogLoveMate + updateLoveMate burns a quota
— verified in the BE service), `otp-get`/`otp-verify` (real SMS via 8x8), `register-tel` (creates a user +
SMS), `check-line` (live LINE). **We refuse to hit them** (real money / irreversible / would mutate the
stack μุน is capturing on), so per "never claim what you can't prove" we do NOT author a type from a guess —
they return `UnverifiedApiResult` = `{ error?: unknown; [key: string]: unknown }`, forcing callers to narrow.

## proof-of-teeth (type-level — the honest types CATCH drift; error paths can't be live-tested)
- **ANCHOR** `constants/api/unverified-result.ts#UnverifiedApiResult` — the shared honest B type.
- **neg-control (run):** revert one narrow — register `if (result && typeof result.code === 'string')` →
  `if (result && result.code)` — tsc goes RED: `register/index.tsx(146,17): TS2345 '{}' not assignable to
  SetStateAction<string>`; restore → tsc CLEAN. So the type surfaces the drift the blind `as` hid.
- **error paths (Calculate null) can't be live-tested** (Calculate saves a chart — refused). Proven by type:
  before the fix tsc flagged `gotoResult(result.code)` / `setCode(result.code)` at 4 sites; after
  optional-chaining + `typeof` narrow, tsc is clean AND happy-path behavior is unchanged (`gotoResult`
  already no-ops on empty; the narrow only skips the same cases the old `if (result.code)` skipped).
- `tsc --noEmit` clean · **42/42** `scripts/*.test.ts` · **zero `as RESPONSE_*` casts remain**.

## the real value — drift the honest types EXPOSED (not just "removed 8 casts")
1. **compatibility-WORK was cast to the LOVE response type** (`RESPONSE_COMPATIBILITY_LOVE_GET` on a WORK
   response) — a copy-paste the blind cast hid system-wide. Approach ก (prettier types) would have typed it
   to match the WRONG cast and NEVER found it. This is why provability > accuracy-by-guess.
2. `api-otp-get` imported `RESPONSE_CHINESE_HOROSCOPE_GET` (2 stray imports) — removed.
3. **register `gotoResult(result.code)` had NO null-check (×2)** — a real crash if Calculate errors, latent
   for a long time because the blind cast told tsc `result` always had `.code`. Fixed.

## NOT claimed
Error responses of the 7 B endpoints are UNVERIFIED (can't hit without live SMS/register/DB-mutation, #184).
Their success/error shapes are intentionally loose — a future accurate-typing pass must hit them from a
safe (mocked-provider) stack, tracked with #184.

## adversary sign-off
**Pending ตู๋ (too).** Lens ask: the A type matches the live 15 keys (no over-claim on leaf shapes) · the B
`UnverifiedApiResult` correctly forces narrowing without breaking happy paths · the 4 Calculate caller fixes
preserve behavior (optional-chain + typeof, gotoResult's existing empty=no-op) · the compatibility-work LOVE
copy-paste is genuinely moot now. Requested after CI green.

ANCHOR: constants/api/unverified-result.ts#UnverifiedApiResult
