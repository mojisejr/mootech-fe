# BE Phase‑1 Consolidation — retire the DUPLICATE parts of `mootech-be` by repointing FE → engine

Status: PLAN (read‑only analysis). Scope: **only** the bazi/horoscope/AI/consent/almanac/matching duplicates.
**Out of scope (Phase 2+, unique to `be`): payments/Omise, user register/login/OTP, object‑storage/upload, member‑payment, logs.**

Repos:
- FE `mootech-fe` (Next.js, strangler‑fig): `constants/api/endpoint.ts` is the ledger.
- BE `mootech-be` (NestJS/TypeORM/Postgres on Render) — the legacy monolith.
- Engine `bazi-sft-dataset` (Next.js/drizzle on Vercel) — **canonical** bazi domain, routes under `src/app/api/*`.

---

## 0. The load‑bearing architectural fact (read this first)

**The FE never points `endpoint.ts` at the engine origin.** `BAZI_BASE_URL` is kept **server‑side only**. Every engine call goes through a **same‑origin BFF** in `mootech-fe/pages/api/*` (or a `v2_*` lane), which then `fetch()`es the engine. `endpoint.ts` only ever holds two kinds of base:
- `backendURLGenerator(path)` → NestJS `be` (env `NEXT_PUBLIC_BACKEND_URL`), and
- `localApi(path)` → same‑origin `/api/*` BFF (which may internally reach Supabase **or** the engine).

Therefore **"repoint FE → engine" in this codebase means one of:**
1. **Flip** an `endpoint.ts` entry from `backendURLGenerator(...)` → `localApi(...)` **where a BFF that bridges to the engine already exists**, or
2. **Migrate the calling screen** onto an already‑built engine‑backed lane (`v2_*` or a `pages/api` BFF) and retire the old `endpoint.ts` entry.

There is **no** safe "just change the URL to the engine" switch, because the engine response shapes differ from `be` (documented per‑endpoint below). This reframes Phase 1: it is a set of **screen cutovers onto lanes that already exist**, not a bulk URL flip. Endpoints whose engine lane/adapter is **not yet built** are explicitly deferred.

---

## 1. Migration ledger — every `endpoint.ts` entry by base

### Still on `be` (`backendURLGenerator`)
| Key | be path | verb | Classification |
|---|---|---|---|
| `chinese_horoscope.calculate` | `POST /chinese-horoscope` | POST | DUPLICATE‑ish — **TRAP** (§3A) |
| `chinese_horoscope.compatibility_love` | `POST /chinese-horoscope/compatibility-love` | POST | DUPLICATE — engine lane = v2 (§3C) |
| `chinese_horoscope.compatibility_work` | `POST /chinese-horoscope/compatibility-work` | POST | DUPLICATE — engine lane = v2 (§3C) |
| `chinese_horoscope.check_compatibility_love` | `GET /chinese-horoscope/compatibility-love` | GET | DUPLICATE — v2 (§3C) |
| `chinese_horoscope.check_compatibility_work` | `GET /chinese-horoscope/compatibility-work` | GET | DUPLICATE — v2 (§3C) |
| `chinese_horoscope.get_share_profile` | `GET /chinese-horoscope/share-profile` | GET | KEEP — be‑specific share (§3D) |
| `otp.get` / `otp.verify` | `/otp`, `/otp/verify` | — | **UNIQUE‑KEEP (auth/OTP)** |
| `user.register_tel/register_line/update_profile_pic/check_line/register_or_login` | `/user/*` | — | **UNIQUE‑KEEP (auth)** |
| `survey.calculate` | `POST /survey/calculate` | POST | KEEP — **no engine equivalent** (§3E) |
| `object_storage.upload/upload_slip` | `/object-storage/*` | — | **UNIQUE‑KEEP (storage)** |
| `card.download` | `POST /card/preview` | POST | KEEP — no engine equivalent (§3F) |
| `fortune_stick.get` | `GET /fortune-stick` | GET | DUPLICATE — engine exists, **lane not built** (§3G) |
| `heaven_spirit_card.get` | `GET /heaven-spirit-card` | GET | DUPLICATE — engine exists, **lane not built** (§3G) |
| `fortune_telling.get` | `GET /fortune-telling` | GET | DUPLICATE‑maybe — no clear engine route (§3G) |
| `payment.*` | `/omise/*`, `/payment` | — | **UNIQUE‑KEEP (money)** |
| `ai.card` / `ai.card_streaming` | `POST /ai/fortune-stick(-streaming)` | POST | DUPLICATE — **lane not built** (§3H) |
| `ai.general` / `ai.general_streaming` | `POST /ai/chat(-streaming)` | POST | DUPLICATE — **new lane exists but not a drop‑in** (§3H) |
| `member_with_friend.create/update/update_profile/new_friend` | `/member-with-friend*` | POST/PUT | KEEP — user CRUD, **not** an engine duplicate; backs the v2 lane (§3I) |
| `user_matching.calculate/get/get_detail/re_calculate` | `/user-matching*` | POST/GET | DUPLICATE — **engine lane READY = `v2_matching`** (§3B, primary Phase‑1 win) |
| `member_payment_code.check` | `GET /member-payment-code/check` | GET | **UNIQUE‑KEEP (money)** |

### Already migrated off `be` — on `localApi` (Supabase or engine BFF)
`chinese_horoscope.get` (hybrid: be chart + engine reading overlay), `user.get`, `survey.get`, `survey.get_share_type`, `product.get`, `log_activity.get`, `log_survey.get`, `log_save_image.insert`, `member_with_friend.get`, `member_with_friend.get_detail`, `chinese_calendar.diary`, `chinese_calendar.month`, `payment_package.get`, all `v2_payment.*`, all `v2_matching.*`.

### FE `pages/api/*` BFF proxies that forward to `be` (`NEXT_PUBLIC_BACKEND_URL`)
- `pages/api/chinese-horoscope.ts` — **hybrid**: GETs `be /chinese-horoscope` stored chart, then overlays engine `POST /api/reading/topic` (consumer mode) text onto love/work/foundation/be‑careful. Still be‑dependent for the whole chart skeleton.
- (Most other `pages/api/*` already bridge to the **engine** via `BAZI_BASE_URL`, not be — see §2.)

### FE `pages/api/*` BFF proxies that already forward to the **engine** (`BAZI_BASE_URL`) — the lanes we cut over to
`consent.ts` → `account/consent`; `chat/bazi.ts` → `bazi/calculate` + `v1/chat/completions`; `bazi-mascot.ts` + `bazi/mascot/[ganzhi].ts` → `bazi/mascot/[ganzhi]`; `bazi/element-summary.ts` → `bazi/element-summary`; `glass-box/chat.ts`; `v2/matching/*` → engine matching flow; `v2/almanac-month.ts`, `v2/calendar-month.ts`, `v2/day-detail.ts` → engine `almanac`; `what-if/generate.ts`; `faq.ts`, `home-fortune.ts`, `missions.ts`, `referral.ts`, `profile.ts`, `notification-prefs.ts`, `qi-*`, `account-export.ts` → engine.

---

## 2. Classification summary

**DUPLICATE (engine is canonical):** chinese‑horoscope calculate/analytic, compatibility love/work, user‑matching, AI chat (general + fortune‑stick), consent, almanac/วันพระ, mascot, divine/oracle/fortune‑stick cards, reference data (matching text, day‑stars).

**UNIQUE‑KEEP (out of Phase 1):** `payment`/`omise`/`member_payment_code`, `otp`, `user.register*`/`register_or_login`/`check_line`, `object_storage`, `member-payment`, all `log-*` write endpoints, `survey.calculate` (personality questionnaire — not a bazi‑engine domain, engine has no route), `card.download` (image compositor — no engine equivalent).

**Nuance — `member_with_friend`:** not a bazi duplicate. It is the friend/partner CRUD that the engine has no model for; it *backs* the v2 compatibility lane (`useCompatibility.ts` calls `MemberWithFriendCreateApi`/`GetDetailApi`). **Keep on be** until a friend model is built in the engine (post‑Phase‑1).

---

## 3. DUPLICATE → engine route mapping + field‑level contract notes

### A. `chinese_horoscope.calculate` / `.get` (the /my‑destiny chart) — **TRAP: do NOT switch**
- **be:** `chinese-horoscope.controller.ts` `POST /` → `ChineseHoroscopeResponse` = `{ dob, time, summary:{element,power,yearAbove…timeBelow}, detail:{…}, analytic:{ base, habit, love, prediction_work, be_careful, behaviors[], occupations, colors, mascot … } }`. This is a rich, be‑only UI contract.
- **engine:** `POST /api/bazi/calculate` returns only `{ calculatedState }` (four pillars + math state). `bazi/strength-score`, `bazi/element-summary`, `bazi/domain-power` exist but the FE **does not** wire them into the destiny page.
- **Reality:** `pages/api/chinese-horoscope.ts` already proves the ceiling — it keeps the **entire be chart** and only overlays *text* on 4 sections via engine `POST /api/reading/topic` (`{topicId, mode:"consumer", rawInput}`). Its own header calls occupations "P0 NO‑GO".
- **Verdict:** the engine cannot yet reproduce `summary`/`detail`/`analytic` (8‑pillar grid, 5‑power, mascot, occupations, colors). **`chinese_horoscope.calculate` and the be chart stay in Phase 1.** No adapter closes this in‑scope. Flag: any attempt to "flip calculate to engine" breaks /my‑destiny.

### B. `user_matching.*` → **`v2_matching.*` (engine lane READY)** — the primary Phase‑1 win
- **be:** `matching.controller.ts` `@Controller('user-matching')` — `POST /` (`MatchingCreateInput{user_id, friend…}`), `POST /recalculate`, `GET /`, `GET /detail`. Quota via `member-payment.service` (money‑adjacent). Writes `log-love-mate`/`log-work-vibe`.
- **engine lane (already built):** FE `pages/api/v2/matching/{calculate,index,[id]}.ts` + `pages/api/v2/matching/work/*`, driven by `lib/matching/calculate-flow.ts` → engine. `v2_matching.*` already in `endpoint.ts`.
- **Contract differences (why it is a cutover, not a URL flip):**
  - **Identity:** be reads `user_id` **from the request body** (forgeable). v2 takes it from the **signed session** (`resolveSessionUserId`); the browser never sends the subject. Request body is `{ friend_id, matching_type: LOVE|BOSS|EMPLOYEE|FRIEND }`.
  - **Quota status code:** be used HTTP `410 GONE` for quota; v2 keeps `410 → 'quota'`, `503 → 'system'` (engine down ≠ quota). Screen already reads this vocab (`useCompatibilityResult.ts`).
  - **Response:** v2 `{ ok:true, matching_id, result }`. Old wrappers expect the be shape.
- **Adapter status:** the v2 lane **is** the adapter (mappers unit‑tested: `scripts/bazi-pair-mapper.test.ts`, `bazi-pair-match-mapper.test.ts`, `compatibility-result.test.ts`). Cutover = point the 3 matching screens at the v2 wrappers.
- **Gating:** endpoint.ts note — *"Flipping v1 over is #247's job at launch."* Phase 1 = execute #247.

### C. `chinese_horoscope.compatibility_love/work` + `check_*` → engine `bazi/pair`, `bazi/work`, `bazi/pair-match`
- **be:** returns the `ChineseHoroscopeResponse` `{summary, detail}` shape (via `CompatibilityLoveAnalyticInput{ user_id, me:{name,gender,dob,time}, you:{…}, type }`).
- **engine:** **completely different shapes.**
  - `POST /api/bazi/pair` `{personA, personB, relationship}` → `{ personA, personB (full BaziState), comparison, facets, mainFacet, loveFacets }`.
  - `POST /api/bazi/work` `{self, candidates[1..3]}` → `{ self, candidates, comparison }`.
  - `POST /api/bazi/pair-match` (zod‑validated, consumer wizard) → slim `{ relationship, overall:{percent,grade,hearts…}, dimensions[], persons:{a,b}, elementInteraction }`.
- **Verdict:** direct swap **breaks FE** (field names, nesting, no `summary`/`detail`). The engine‑backed consumer path is the **same v2 compatibility lane as §B** (`useCompatibility.ts` + `v2/matching/*`, UX #357). **Adapter needed = the v2 lane;** raw endpoint swap is a trap. Cut over with §B under #247.

### D. `chinese_horoscope.get_share_profile` — KEEP
be‑specific stored share URL; no engine equivalent. Leaves be last, with the chart (§A).

### E. `survey.calculate` — KEEP (not a duplicate)
`be survey.controller.ts @Controller('survey') @Post('calculate')` — personality questionnaire scoring. Engine has **no** survey route. `survey.get`/`get_share_type` already static‑migrated; `calculate` stays be until separately ported (not Phase 1).

### F. `card.download` (`POST /card/preview`) — KEEP
be `card.controller.ts` composes a JPEG (`mascotUrl+title+description`) with node‑canvas/fonts. Engine has `divine-cards/images` & `oracle-cards/images` (card art), **not** a generic share‑image compositor. No engine equivalent → keep.

### G. `fortune_stick.get`, `heaven_spirit_card.get`, `fortune_telling.get` — DUPLICATE, **lane not built**
- be: all `GET` returning reference/prediction JSON (`fortune-stick.controller.ts`, etc.).
- engine: `POST /api/fortune-sage/predict` `{question?,topic?,no?,anonId?}` → `{stick, question, topic}` (+ `GET` list all sticks); plus `divine-cards/predict`, `oracle-cards/predict`.
- **Contract mismatch:** verb (GET→POST), body vs query, `{stick}` vs be shape, plus engine Qi‑quota gate (`qiGate(anonId,"card")`). **No FE BFF bridges these yet.** → requires a new `pages/api` BFF + response adapter before any switch. **Defer** (candidate for a Phase‑1.5 once the adapter is written).

### H. `ai.general(_streaming)` / `ai.card(_streaming)` — DUPLICATE, not a drop‑in
- be `ai.controller.ts`: `POST /ai/chat(-streaming)` (Mate general chat), `POST /ai/fortune-stick`, plus `GET balance/:id` and secret‑guarded `POST consume`.
- engine: `POST /api/v1/chat/completions` (OpenAI‑style SSE, `Authorization: Bearer OPEN_WEBUI_API_TOKEN`) grounded by `baziConsult:{rawInput,calculatedState}`.
- **New engine lane exists** = `pages/api/chat/bazi.ts` (resolves birth server‑side from the session, calls `bazi/calculate` then `v1/chat/completions`, reuses the **same AI_GENERAL wallet** via `lib/credit/wallet-client`). Consumed by `features/v2-chat/useBaziChatStream.ts` and `features/glass-box/*`.
- **But** it is a *bazi‑grounded* chat, not a byte‑for‑byte replacement of the old free‑form Mate chat (`components/modal-ai-chat*.tsx` still call `api-ai-general*`). Cutover = migrate those modals to the bazi chat lane — a **screen/product decision**, not a URL flip. **Defer** to a dedicated chat‑cutover ticket (keep out of the "safe" Phase‑1 set). Note the credit wallet is shared, so don't delete be `ai` wallet endpoints until the modals are migrated.

### I. `consent` — already 100% on the engine (no `endpoint.ts` entry)
- FE `pages/api/consent.ts` → engine `GET/POST /api/account/consent` (`anonId` from `cookie-mumate-id`). Contract matches (`{consents[], latest}` / `{ok,id,createdAt}`).
- be `consent` module has **no** `endpoint.ts` reference and no other FE caller. → **already dead from FE's side**; just needs BE‑team deletion confirmation. **Safest item in Phase 1.**

### J. mascot — bridged (`bazi-mascot.ts` → engine `bazi/mascot/[ganzhi]`), but be `mascot.service` is still called *inside* the be chart (§A), so its deletion is blocked until §A retires.

### K. almanac/วันพระ — engine `almanac` already the single source via `v2/almanac-month.ts` etc. The be calendar family (`chineses-calendar`, `calendar-100-year`, `holiday`) is a **different** dataset (legacy Supabase flags) still used by `chinese_calendar.*` (already localApi‑Supabase, not be). No `endpoint.ts` be entry to flip here; no Phase‑1 action beyond noting the two datasets must not be re‑forked.

---

## 4. Phase‑1 execution checklist (safest → riskiest)

### Switch 1 — `consent` (SAFEST; zero FE change)
- **endpoint.ts:** none (already off be).
- **Adapter:** none (contract matches).
- **Verify:** `scripts/consent-header.test.tsx`; manual PDPA consent banner GET/POST via `/api/consent`.
- **Dead be modules on ship:** `src/consent/` (controller/service/entity/dto).
- **Hand to BE team:** delete `consent` module; confirm no server‑internal caller (cron/line‑message) references it.

### Switch 2 — `user_matching.*` → `v2_matching.*` (primary; execute #247)
- **endpoint.ts:** retire `user_matching.{calculate,get,get_detail,re_calculate}` after screens move; `v2_matching.*` already present.
- **FE change:** repoint `pages/matching/index.tsx`, `pages/matching/recent/index.tsx`, `pages/matching/result/index.tsx` from `api-user-matching-*` wrappers to the v2 wrappers/hooks (`useCompatibility`, `useCompatibilityResult`, `lib/api-v2-matching`).
- **Adapter:** already built + tested (`scripts/bazi-pair-mapper.test.ts`, `bazi-pair-match-mapper.test.ts`, `compatibility-result.test.ts`, `compat-readers-v2-lane.test.ts`, `matching-quota-gate.test.ts`, `matching-target.test.ts`).
- **Verify:** e2e `e2e/v2-compat-error-reasons.spec.ts`, `v2-edit-friend.spec.ts`, `v2-quota-indicator.spec.ts`; screens = matching wizard + result + recent.
- **Dead be modules on ship:** `src/matching/` (controller/service/`bazi`/dto/entity). **NOT deletable yet:** `log-love-mate`, `log-work-vibe` (also written by `chinese-horoscope.module`/`.service`), and `member-payment` (matching imports it, but it's UNIQUE‑KEEP anyway).
- **Hand to BE team:** delete `matching` module + `UserMatchingController` route; **do not** touch `member-payment`/`member-with-friend` (shared).
- **Risk:** identity model changed (session vs body `user_id`) and quota code (`410` vs `503`) — both already handled in the v2 lane; ensure `#247` ships the wrappers, not a URL flip.

### Switch 3 — compatibility love/work (rides with Switch 2)
- Same v2 lane and mappers as Switch 2. Retire `chinese_horoscope.compatibility_*` + `check_compatibility_*` once the compat screens are on the v2 hook.
- **Dead be on ship:** the `compatibility-love`/`compatibility-work` **services** and the compat routes in `chinese-horoscope.controller.ts` — but the controller file also serves the chart (§A), so **remove the compat handlers only**, keep `POST /` + `GET /` + `share-profile` until §A retires.

### Deferred within the bazi domain (adapter/lane not yet built — NOT in the safe set)
- **D1 fortune‑stick / heaven‑spirit / divine‑oracle cards** (§G): build `pages/api` BFF + response adapter for engine `fortune-sage/predict` & `*-cards/predict` (verb + shape + Qi‑gate), then flip `fortune_stick.get` / `heaven_spirit_card.get`. `fortune_telling.get` needs an engine route identified first.
- **D2 AI chat modals** (§H): migrate `components/modal-ai-chat*.tsx` from `api-ai-general*` to the bazi chat lane; product decision on bazi‑grounding. Keep be `ai` wallet endpoints until done (shared credit).
- **D3 chinese‑horoscope chart** (§A): blocked until the engine reproduces `analytic` (occupations/colors/mascot/5‑power). Keep on be.

---

## 5. Risks & "looks‑duplicate‑but‑contract‑differs" traps

1. **Chart create (§A) is not swappable.** `bazi/calculate` returns only `calculatedState`; the be chart's `summary/detail/analytic` (8‑pillar grid, 5‑power, occupations, colors, mascot) has no engine equivalent yet. The hybrid BFF proves this by keeping the be chart and overlaying only text. Do not flip `chinese_horoscope.calculate`.
2. **Compatibility shapes are incompatible.** be returns `{summary, detail}`; engine `pair`/`work`/`pair-match` return `{personA,personB,comparison,facets}` / `{overall,dimensions,persons}`. A raw URL swap breaks the FE — must go through the v2 lane.
3. **Identity regression risk.** be matching trusts a body `user_id` (and the `MEMBER_ID` cookie is forgeable). The engine lane fixes this via the signed session. Do not preserve the old body‑subject contract when cutting over.
4. **Quota code semantics.** be `410 GONE` = quota; engine down must be `503`, never `410`, or an outage renders as "โควตาเต็ม" (#263). The v2 lane already encodes this.
5. **Money/auth‑adjacent — keep OUT of Phase 1:** `payment`/`omise`/`member_payment_code`, `otp`, `user.register*`, `object_storage`, `member-payment`. Note `matching` *imports* `member-payment.service` for its quota gate — deleting `matching` is fine, but **do not** delete `member-payment`.
6. **Shared logs & friend CRUD are not duplicates.** `log-love-mate`/`log-work-vibe` are written by both matching **and** the chart module → not deletable with matching. `member-with-friend` create/update backs the v2 compat lane and has no engine model → keep.
7. **Two calendar datasets.** Engine `almanac` (วันพระ, bazi‑computed) vs be/Supabase `chinese-calendar` (legacy flags) are different sources; keep them from re‑forking (`v2/almanac-month.ts` header). No be flip here.
8. **AI wallet is shared.** The bazi chat lane reuses the AI_GENERAL wallet; don't retire be `ai` balance/consume endpoints until the chat modals migrate.

---

## 6. Hand‑off to the BE team (per switch)
- **On Switch 1 ship:** delete `src/consent/`; scrub `consent` from `app.module.ts`; confirm no internal caller.
- **On Switch 2/3 ship:** delete `src/matching/` and the compat handlers in `chinese-horoscope.controller.ts`; **retain** `member-payment`, `member-with-friend`, `log-love-mate`, `log-work-vibe`.
- **Render decommission:** none until §A (chart) also leaves be — the NestJS service still serves the chart, share‑profile, survey.calculate, card, OTP, user auth, payments, object‑storage. Phase 1 shrinks the module surface but the service stays up.
- **Env cleanup (FE):** none removed — `NEXT_PUBLIC_BACKEND_URL` still needed for the chart/auth/payment families; `BAZI_BASE_URL` + `OPEN_WEBUI_API_TOKEN` already present.
