// Same-origin API paths — every endpoint this app serves itself under pages/api/*. CIEL
// mumate-be-retirement-001 slice 2b.
//
// Split out of ./endpoint so that v2 code can name its routes WITHOUT importing ./endpoint, which still
// carries the retired mootech-be entries (v1 only, unreachable) and the ENDPOINT constant. Anything that
// imports ./endpoint puts every one of those backend paths into its client chunk; importing this file puts
// only "/api/..." strings there. ./endpoint re-exports these values through API, so it remains the one
// ledger of every path, and the two cannot drift (scripts/be-seam-closed.test.ts checks both).
//
// Rules: only localApi here — no ENDPOINT, no host, no import of ./endpoint or next/config.
const localApi = (pathname: string) => `/api${pathname}`

export const LOCAL_API = {
  chinese_horoscope: {
    save_birth: localApi('/v2/birth-chart'),
    get: localApi('/chinese-horoscope'),
  },
  user: {
    get: localApi('/user'),
    register_or_login: localApi('/auth/register-login-fe'),
  },
  survey: {
    get: localApi('/survey'),
    get_share_type: localApi('/survey/share-type'),
  },
  product: {
    get: localApi('/product'),
  },
  log_activity: {
    get: localApi('/log-activity'),
  },
  log_survey: {
    get: localApi('/log-survey'),
  },
  object_storage: {
    upload: localApi('/object-storage/upload-file'),
  },
  log_save_image: {
    insert: localApi('/log-save-image'),
  },
  member_with_friend: {
    create: localApi('/member-with-friend'),
    get: localApi('/member-with-friend'),
    get_detail: localApi('/member-with-friend/detail'),
    update_profile: localApi('/member-with-friend/profile'),
    delete: localApi('/member-with-friend'),
  },
  chinese_calendar: {
    diary: localApi('/chinese-calendar/diary'),
    month: localApi('/chinese-calendar/month'),
  },
  payment_package: {
    get: localApi('/payment-package'),
  },
  v2_payment: {
    preview: localApi('/v2/payment/preview'),
    charge: localApi('/v2/payment/charge'),
    promptpay: localApi('/v2/payment/promptpay'),
    status: localApi('/v2/payment/status'),
    webhook: localApi('/v2/payment/webhook'),
  },
  v2_matching: {
    calculate: localApi('/v2/matching/calculate'),
    get: localApi('/v2/matching'),
    get_detail: localApi('/v2/matching'),
    work: localApi('/v2/matching/work'),
  },
} as const
