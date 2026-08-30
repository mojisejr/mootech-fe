import getConfig from 'next/config'

const { publicRuntimeConfig } = getConfig()

// Backend base for NOT-yet-migrated endpoints (calc-family etc.). Points ONLY at our own
// NestJS-on-Supabase. Default is the local NestJS (:4000). The OLD-PROD URL has been removed
// on purpose — see the guardrail below.
//
// 🚫 GUARDRAIL — NEVER touch the old team's database (#mootech-fullstack-supabase-fold)
// Our Supabase is a one-time pgloader copy of the old MySQL; the two have diverged. We must
// NEVER read/write the old prod backend (it would hit live users' real DB). This codebase must
// never reference `bazichart.mumate.co` (or any old-prod host). The assert below fails LOUD if
// ENDPOINT is ever pointed there via env — do not weaken or remove it.
export const ENDPOINT = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";

const OLD_PROD_FORBIDDEN = /bazichart\.mumate\.co/i;
if (OLD_PROD_FORBIDDEN.test(ENDPOINT)) {
  throw new Error(
    `[GUARDRAIL] ENDPOINT points at the old prod DB (${ENDPOINT}). ` +
      `We never touch the old team's database. Set NEXT_PUBLIC_BACKEND_URL to our own NestJS-on-Supabase.`,
  );
}

const backendURLGenerator = (pathname: string) => `${ENDPOINT}${pathname}`

// --- strangler-fig base-URL split (#mootech-fullstack-supabase-fold) ---
// Endpoints MIGRATED into this Next.js app (pages/api/* -> Supabase via Drizzle) use
// `localApi` (same-origin /api). Everything not yet migrated stays on the NestJS
// `backendURLGenerator` (ENDPOINT). To roll an endpoint back, flip localApi -> backendURLGenerator.
const localApi = (pathname: string) => `/api${pathname}`

export const API = {
  chinese_horoscope: {
    calculate: backendURLGenerator('/chinese-horoscope'),
    // GET routed to hybrid BFF (#my-destiny-bazi-engine-swap): overlays bazi readings on the
    // 3 top cards + love + work, keeps everything else be. Flip to backendURLGenerator to roll back.
    get: localApi('/chinese-horoscope'),
    compatibility_love: backendURLGenerator('/chinese-horoscope/compatibility-love'),
    compatibility_work: backendURLGenerator('/chinese-horoscope/compatibility-work'),
    get_share_profile: backendURLGenerator('/chinese-horoscope/share-profile'),
    check_compatibility_work: backendURLGenerator('/chinese-horoscope/compatibility-work'),
    check_compatibility_love: backendURLGenerator('/chinese-horoscope/compatibility-love'),
  },
  otp: {
    get: backendURLGenerator('/otp'),
    verify: backendURLGenerator('/otp/verify'),
  },
  user: {
    get: localApi('/user'), // MIGRATED -> pages/api/user.ts (Supabase/Drizzle, getUserById parity)
    register_tel: backendURLGenerator('/user/register-tel'),
    register_line: backendURLGenerator('/user/register-line'),
    update_profile_pic: backendURLGenerator('/user/profile-pic'),

    check_line: backendURLGenerator('/user/check-line'),
    register_or_login: backendURLGenerator('/user/register-login')
  },
  survey: {
    get: localApi('/survey'), // MIGRATED -> pages/api/survey/index.ts (static questionnaire)
    calculate: backendURLGenerator('/survey/calculate'),
    get_share_type: localApi('/survey/share-type'), // MIGRATED -> pages/api/survey/share-type.ts
  },
  product: {
    get: localApi('/product'), // MIGRATED -> pages/api/product.ts (Supabase/Drizzle)
  },
  log_activity: {
    get: localApi('/log-activity'), // MIGRATED -> pages/api/log-activity.ts (Supabase/Drizzle)
  },
  log_survey: {
    get: localApi('/log-survey'), // MIGRATED -> pages/api/log-survey.ts (Supabase/Drizzle)
  },
  object_storage: {
    upload: backendURLGenerator('/object-storage/upload-file'),
    upload_slip: backendURLGenerator('/object-storage/upload-slip'),
  },  
  card: {
    download: backendURLGenerator('/card/preview'),
  },
  log_save_image: {
    insert: localApi('/log-save-image') // MIGRATED -> pages/api/log-save-image.ts (Drizzle insert)
  },
  fortune_stick: {
    get: backendURLGenerator('/fortune-stick')
  },
  heaven_spirit_card: {
    get: backendURLGenerator('/heaven-spirit-card')
  },
  fortune_telling: {
    get: backendURLGenerator('/fortune-telling')
  },
  payment: {
    pay_via_credit_card: backendURLGenerator('/omise/charge'),
    pay_via_qr_code: backendURLGenerator('/omise/promptpay'),
    create: backendURLGenerator('/payment'),
    retrieve: backendURLGenerator('/omise/retrieve'),
  },
  ai: {
    card: backendURLGenerator('/ai/fortune-stick'),
    card_streaming: backendURLGenerator('/ai/fortune-stick-streaming'),
    general: backendURLGenerator('/ai/chat'),
    general_streaming: backendURLGenerator('/ai/chat-streaming'),
  },
  member_with_friend: {
    create: backendURLGenerator('/member-with-friend'),
    get: localApi('/member-with-friend'), // MIGRATED -> pages/api/member-with-friend/index.ts (read + usage gate + user join)
    get_detail: localApi('/member-with-friend/detail'), // MIGRATED -> pages/api/member-with-friend/detail.ts (read, no gate)
    update: backendURLGenerator('/member-with-friend'),
    update_profile: backendURLGenerator('/member-with-friend/profile'),
    new_friend: backendURLGenerator('/member-with-friend/new-friend'),
  },
  user_matching: {
    calculate: backendURLGenerator('/user-matching'),
    get: backendURLGenerator('/user-matching'),
    get_detail: backendURLGenerator('/user-matching/detail'),
    re_calculate: backendURLGenerator('/user-matching/recalculate'),
  },
  member_payment_code: {
    check: backendURLGenerator('/member-payment-code/check'),
  },
  chinese_calendar: {
    diary: localApi('/chinese-calendar/diary'), // MIGRATED -> pages/api/chinese-calendar/diary.ts (5 lookups + usage gate)
    month: localApi('/chinese-calendar/month'), // MIGRATED -> pages/api/chinese-calendar/month.ts (usage gate)
  },
  payment_package: {
    get: localApi('/payment-package'), // MIGRATED -> pages/api/payment-package.ts
  },
  // v2 payment (#355) — NEW category, ADD-ONLY. The v1 `payment.*` above is untouched (v1 still takes
  // money through it). All same-origin (localApi → /api/v2/...); the webhook is called by Omise, not the
  // client, but it lives here for one place that names every v2 payment path.
  v2_payment: {
    preview: localApi('/v2/payment/preview'), // #361 — price a package (+ discount code) without charging
    charge: localApi('/v2/payment/charge'),
    promptpay: localApi('/v2/payment/promptpay'),
    status: localApi('/v2/payment/status'),
    webhook: localApi('/v2/payment/webhook'),
  },
  // v2 ดวงสมพงษ์ (#357) — NEW category, ADD-ONLY. The v1 `user_matching.*` above is untouched: v1 screens
  // still go through mootech-be, and both lanes run side by side. Flipping v1 over is #247's job at launch.
  // Same-origin (localApi → /api/v2/...); the caller is never named in the request — the session is.
  v2_matching: {
    calculate: localApi('/v2/matching/calculate'),
    get: localApi('/v2/matching'),
    get_detail: localApi('/v2/matching'), // + '/<matching_id>' — see api-v2-matching.ts
  },
}
