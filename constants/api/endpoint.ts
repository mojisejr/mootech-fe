import getConfig from 'next/config'
import { LOCAL_API } from './endpoint-local'

const { publicRuntimeConfig } = getConfig()

// ⛔ mootech-be IS RETIRED FROM THIS APP — CIEL mumate-be-retirement-001 slice 2b (plan rev 0.4).
//
// Every entry below that still uses `backendURLGenerator` belongs to v1, and every v1 route is redirected to
// v2 by middleware.ts (lib/v1-retired-routes.ts), so none of those wrappers can run. The PR that made this so
// lists each one and why it is unreachable. v1 code is kept on the owner's word ("ไม่ต้องลบ code แต่ทำให้
// ใช้ไม่ได้", R1) — deleting it is optional later cleanup.
//
// ENDPOINT no longer reads NEXT_PUBLIC_BACKEND_URL. That variable has left the env contract (.env.example,
// Dockerfile, container build), and this file must not keep an undeclared read of it: a NEXT_PUBLIC_ value
// that is still set on a platform would otherwise be inlined into the client bundle and put the retired
// backend's host back on the wire. The constant below is a local development address, never a deployed one,
// so the unreachable v1 wrappers point nowhere.
//
// The old-prod guardrail that lived here (#mootech-fullstack-supabase-fold: throw if the env pointed at the
// old team's backend) guarded the env read. With the read gone, ENDPOINT is a constant and cannot be pointed
// anywhere, so there is nothing left for it to check.
//
// To bring a v1 call back you would revert slice 2 as a whole; the login flip's BE rollback
// (`register_or_login` below) ended with it.
export const ENDPOINT = "http://localhost:4000";

const backendURLGenerator = (pathname: string) => `${ENDPOINT}${pathname}`

// --- strangler-fig base-URL split (#mootech-fullstack-supabase-fold) ---
// Endpoints MIGRATED into this Next.js app (pages/api/* -> Supabase via Drizzle) use
// `localApi` (same-origin /api). What still names `backendURLGenerator` is v1 only and unreachable
// (see the note at the top). Flipping an entry back to `backendURLGenerator` no longer rolls it back.
// The same-origin entries now live in ./endpoint-local (LOCAL_API) and are re-exported through API below,
// so this file stays the full ledger. v2 code imports LOCAL_API directly: that keeps THIS module — and with
// it every backend path and ENDPOINT — out of the chunks v2 pages load (DoD V3, be-retirement slice 2b).

export const API = {
  chinese_horoscope: {
    calculate: backendURLGenerator('/chinese-horoscope'), // v1 only (unreachable after slice 2). NOT repointed: v1 /friend calls it for a FRIEND's birth with no user_id; a session-bound writer would save that birth onto the member.
    // MIGRATED mumate-be-retirement-001 slice 1 -> pages/api/v2/birth-chart.ts (v2 register + edit-birth; session-bound, writes user + minimal log_calculate)
    save_birth: LOCAL_API.chinese_horoscope.save_birth,
    // GET -> pages/api/chinese-horoscope.ts: since mumate-be-retirement-001 slice 1, the member's chart
    // derived live from the bazi engine (no BE, no stored chart). Serves v2 home + first-run.
    get: LOCAL_API.chinese_horoscope.get,
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
    get: LOCAL_API.user.get, // MIGRATED -> pages/api/user.ts (Supabase/Drizzle, getUserById parity)
    register_tel: backendURLGenerator('/user/register-tel'),
    register_line: backendURLGenerator('/user/register-line'),
    update_profile_pic: backendURLGenerator('/user/profile-pic'),

    check_line: backendURLGenerator('/user/check-line'),
    register_or_login: LOCAL_API.user.register_or_login // MIGRATED slice 6 -> pages/api/auth/register-login-fe.ts. The BE rollback (backendURLGenerator('/user/register-login')) ended with be-retirement slice 2b: ENDPOINT no longer reaches a BE.
  },
  survey: {
    get: LOCAL_API.survey.get, // MIGRATED -> pages/api/survey/index.ts (static questionnaire)
    calculate: backendURLGenerator('/survey/calculate'),
    get_share_type: LOCAL_API.survey.get_share_type, // MIGRATED -> pages/api/survey/share-type.ts
  },
  product: {
    get: LOCAL_API.product.get, // MIGRATED -> pages/api/product.ts (Supabase/Drizzle)
  },
  log_activity: {
    get: LOCAL_API.log_activity.get, // MIGRATED -> pages/api/log-activity.ts (Supabase/Drizzle)
  },
  log_survey: {
    get: LOCAL_API.log_survey.get, // MIGRATED -> pages/api/log-survey.ts (Supabase/Drizzle)
  },
  object_storage: {
    upload: LOCAL_API.object_storage.upload, // MIGRATED be-retirement 1f -> pages/api/object-storage/upload-file.ts (session-bound, Supabase Storage). Shared with v1 modal-image-crop. Its BE rollback ended with be-retirement slice 2b.
    upload_slip: backendURLGenerator('/object-storage/upload-slip'),
  },  
  card: {
    download: backendURLGenerator('/card/preview'),
  },
  log_save_image: {
    insert: LOCAL_API.log_save_image.insert // MIGRATED -> pages/api/log-save-image.ts (Drizzle insert)
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
    create: LOCAL_API.member_with_friend.create, // MIGRATED be-retirement 1e -> pages/api/member-with-friend/index.ts (POST branch, session-bound, BE quota). Its BE rollback ended with be-retirement slice 2b.
    get: LOCAL_API.member_with_friend.get, // MIGRATED -> pages/api/member-with-friend/index.ts (read + usage gate + user join)
    get_detail: LOCAL_API.member_with_friend.get_detail, // MIGRATED -> pages/api/member-with-friend/detail.ts (read, no gate)
    update: backendURLGenerator('/member-with-friend'),
    update_profile: LOCAL_API.member_with_friend.update_profile, // MIGRATED be-retirement 1e -> pages/api/member-with-friend/profile.ts (session-bound, own rows only). Its BE rollback ended with be-retirement slice 2b.
    new_friend: backendURLGenerator('/member-with-friend/new-friend'),
    delete: LOCAL_API.member_with_friend.delete, // MIGRATED -> pages/api/member-with-friend/index.ts (DELETE branch)
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
    diary: LOCAL_API.chinese_calendar.diary, // MIGRATED -> pages/api/chinese-calendar/diary.ts (5 lookups + usage gate)
    month: LOCAL_API.chinese_calendar.month, // MIGRATED -> pages/api/chinese-calendar/month.ts (usage gate)
  },
  payment_package: {
    get: LOCAL_API.payment_package.get, // MIGRATED -> pages/api/payment-package.ts
  },
  // v2 payment (#355) — NEW category, ADD-ONLY. The v1 `payment.*` above is untouched (v1 still takes
  // money through it). All same-origin (localApi → /api/v2/...); the webhook is called by Omise, not the
  // client, but it lives here for one place that names every v2 payment path.
  v2_payment: {
    preview: LOCAL_API.v2_payment.preview, // #361 — price a package (+ discount code) without charging
    charge: LOCAL_API.v2_payment.charge,
    promptpay: LOCAL_API.v2_payment.promptpay,
    status: LOCAL_API.v2_payment.status,
    webhook: LOCAL_API.v2_payment.webhook,
  },
  // v2 ดวงสมพงษ์ (#357) — NEW category, ADD-ONLY. The v1 `user_matching.*` above is untouched: v1 screens
  // still go through mootech-be, and both lanes run side by side. Flipping v1 over is #247's job at launch.
  // Same-origin (localApi → /api/v2/...); the caller is never named in the request — the session is.
  v2_matching: {
    calculate: LOCAL_API.v2_matching.calculate,
    get: LOCAL_API.v2_matching.get,
    get_detail: LOCAL_API.v2_matching.get_detail, // + '/<matching_id>' — see api-v2-matching.ts
    // #585 colleague lane. ONE value for both verbs, because it is one route in two shapes:
    // POST here starts a comparison (ก้อน 4), GET + '/<matching_id>' reads a stored one back (ก้อน 5).
    // It was named `work_detail` while only the GET existed; two constants holding the same string would
    // be two things to keep in step for no gain.
    work: LOCAL_API.v2_matching.work,
  },
}
