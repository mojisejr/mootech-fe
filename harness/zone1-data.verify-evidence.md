# verify-evidence — Zone-1 ก้อน 1 (data + bugs), goo · [task:179 / #179]

FROZEN spec: bongbing-oracle/ψ/plans/2026-07-26_FROZEN-zone1-100-percent.md. Five items, ONE PR, my files
only (pages/v2/index.tsx · pages/api/home-fortune.ts · features/auth/hooks/useV2Home.ts ·
features/home/hooks/useHomeFortune.ts · constants/api/api-chinese-horoscope-get.ts + the two pure modules
+ tests). μุน owns V2HomeScreen; the only shared point is her optional `profile?` prop (this PR passes it).

## proof-of-teeth
- **[1] "ควรเลี่ยง" read BY KEY — ANCHOR** `scripts/home-fortune-best-worst.test.ts#best-worst-by-key`:
  neg-control-first — fix 5/5; MUTANT (restore `summaryItems[last]`) → 4 fail, `worst='ดูแลเอาใจใส่'`
  (officer) CAUGHT; restore → 5/5. **Live A/B on the REAL /v2 route** (dev-login anonymized 5c7befb3,
  same user, running local stack): my FE (:3001) card `ควรเลี่ยง = "อยู่บ้าน / คุมลูกน้อง / อยู่ในห้อง"`
  (key==='worst') vs the OLD FE (:3000) card = `"ดูแลเอาใจใส่"` (officer) — exactly matches บอง's raw-bazi
  verification. The updated `home-fortune-fields.test.ts` fixture now carries the real keys (best·worst·officer,
  officer last) so it also guards the [last] regression.
- **[2] header profile + กติกา ค — ANCHOR** `scripts/home-profile.test.ts#show-upgrade-rule-c`: 7/7 incl.
  the strict-`===true` neg-control (a truthy non-boolean must NOT hide the badge). `deriveHomeProfile` is a
  pure module (lib/home/profile.ts) matching v1 `header-v2.tsx:86` so paid-status can't diverge between
  versions. showUpgrade = `!(payment?.is_not_expired === true)`; pictureUrl = real url else null.
- **[2] #165 single UserGetById**: useV2Home is now the ONE owner of the /api/user fetch and exposes the
  fetched `user`; useHomeFortune consumes it (no second UserGetById — it no longer imports UserGetById).
  Live: /api/user calls on the home mount dropped 3 → 2 in dev (StrictMode double of the single owner);
  PROD mounts once → 1. Fortune still renders (card_rendered=true).
- **[3] #176 doneRef (useV2Home)**: removed the persistent doneRef latch → idempotent effect (per-run
  `alive`, router via ref so it isn't a dep), same fix class as the #110 fortune-card hang. The post-fetch
  `if (!alive) return` guards the register redirect too, so only the surviving StrictMode run redirects.
  Live: /v2 renders home (no hang), ธาตุ line = "ธาตุของคุณคือ ดิน · ดิถีสมดุล" (element NOT regressed).
- **[4] #167 (api-chinese-horoscope-get.ts)**: the `/api/chinese-horoscope` route returns `{ data: chart }`
  but the old `as RESPONSE_CHINESE_HOROSCOPE_GET` cast erased the `.data` hop from tsc (what "ate" the
  element). Fix (Zone-1 scope): return `{ data?: any; error?: unknown }` so a FLAT read (`chart.summary`)
  no longer type-checks. Verified via tsc that the fully-strict RESPONSE_ typing would break pages/my-destiny
  (reads power/analytic.life/share_profile_url not on that type) — so inner-shape tightening is deferred with
  the other 7 `as RESPONSE_*` sites, NOT done here (locked scope). Live: ธาตุ element still renders.
- **[5] stale comment**: home-fortune.ts NOTE updated — bazi now forwards grade + summaryHeadline +
  summaryItems (บอง verified live: grade=B+, summaryHeadline present); comment no longer claims they're dropped.
- **full suite**: 42/42 `scripts/*.test.ts` pass (incl. the updated fixture); `tsc --noEmit` clean EXCEPT the
  one intended `profile` prop on V2HomeScreen (μุน's optional `profile?` lands with #180 — this PR merges
  main after #180 → green before review; per บอง, review is NOT requested while red).

## NOT claimed / scope
- Header/avatar/badge RENDERING is μุน's ก้อน 2 (#180) — this PR only produces `profile` + passes it.
- #167 inner-shape typing + the other 7 `as RESPONSE_*` sites — deferred (locked).
- The dev-only StrictMode double of UserGetById/home-fortune is the accepted idempotency tradeoff (#110), not a regression.

## adversary sign-off
**Pending ตู๋ (too).** Cross-lens ask: static/AST on the useV2Home idempotent effect (latch removal + the
redirect-under-alive guard + router-ref deps) · the #165 seam (single fetch threaded to useHomeFortune, no
hidden second fetch) · the #167 envelope type (Zone-1 scope vs the deferred my-destiny break) · confirm the
bestWorstText per-field fallback. Review requested only after #180 lands + main merged + CI green (บอง's rule).

ANCHOR: scripts/home-fortune-best-worst.test.ts#best-worst-by-key

ANCHOR: scripts/home-profile.test.ts#show-upgrade-rule-c
