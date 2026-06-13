import getConfig from 'next/config'

const { publicRuntimeConfig } = getConfig()

// Backend base for NOT-yet-migrated endpoints (calc-family etc.). Env-overridable so local
// dev can point at the local NestJS-on-Supabase (NEXT_PUBLIC_BACKEND_URL=http://localhost:3000)
// instead of old prod (which is a different DB and doesn't know our dump's users).
export const ENDPOINT = process.env.NEXT_PUBLIC_BACKEND_URL || "https://bazichart.mumate.co/api/v1";
const backendURLGenerator = (pathname: string) => `${ENDPOINT}${pathname}`

// --- strangler-fig base-URL split (#mootech-fullstack-supabase-fold) ---
// Endpoints MIGRATED into this Next.js app (pages/api/* -> Supabase via Drizzle) use
// `localApi` (same-origin /api). Everything not yet migrated stays on the NestJS
// `backendURLGenerator` (ENDPOINT). To roll an endpoint back, flip localApi -> backendURLGenerator.
const localApi = (pathname: string) => `/api${pathname}`

export const API = {
  chinese_horoscope: {
    calculate: backendURLGenerator('/chinese-horoscope'),
    get: backendURLGenerator('/chinese-horoscope'),
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
    get: backendURLGenerator('/survey'),
    calculate: backendURLGenerator('/survey/calculate'),
    get_share_type: backendURLGenerator('/survey/share-type'),
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
    insert: backendURLGenerator('/log-save-image')
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
    get: backendURLGenerator('/member-with-friend'),
    get_detail: backendURLGenerator('/member-with-friend/detail'),
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
    diary: backendURLGenerator('/chinese-calendar/diary'),
    month: backendURLGenerator('/chinese-calendar/month'),
  },
  payment_package: {
    get: backendURLGenerator('/payment-package'),
  },
}
