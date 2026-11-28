// The ONLY list of events this app may send to Google Analytics, and the ONLY list of parameter keys
// each may carry. Everything analytics goes through lib/analytics/track.ts, which refuses anything not
// written here. (CIEL mootech-ga4-instrumentation-001, decision D5: one door for events.)
//
// 🔴 WHY A LIST AND NOT A CONVENTION. The data GA must never see is the data this app is made of —
// birth date and time, the element and zodiac derived from them, LINE/Google/Facebook identities,
// names, emails, phones, the raw member id. A convention ("just don't send those") is one refactor
// away from being forgotten. A list means the NEXT event someone adds has to be written down here,
// and scripts/analytics-track.test.ts reddens on any key that smells like identity or birth data even
// if it is added to this list by mistake.
//
// Names follow GA4's recommended events where one exists (login, sign_up) so GA's own reports light up
// without configuration. Custom names are snake_case.

export const ANALYTICS_EVENTS = {
  /** A member id has just been established in this browser (register-login round-trip landed). */
  login: ['method'],
  /** First-run completed for this account — the v2 "member" definition (user.onboarded_at written). */
  sign_up: ['method'],
  /** The PDPA analytics switch changed. Carries only the new state, never who changed it. */
  consent_update: ['analytics'],
  /** ปีชง 2570 page (ciel-os mumate-taisui-2570-001). Counts and flags only — never an animal, element or birth. */
  taisui_open: ['ref'],
  taisui_form_submit: ['time_known'],
  taisui_result: ['pillars', 'member'],
  taisui_login_click: ['from'],
  taisui_share: ['channel'],
  taisui_packet_open: ['member'],
  taisui_lantern: [],
  /** Shop block clicks (revision 0.11): item is 'mu' or 'planner'. */
  taisui_shop: ['item'],
  taisui_oa_claim: ['result'],
  taisui_oa_cel: ['action'],
  taisui_deeper: ['from'],
  taisui_way: ['pick'],
  taisui_gate: ['from'],
  /** แผนชีวิตปีใหม่ 2570 (/v2/newyear, team meeting 2026-11-24 item 13). Flags only — never a birth or a price. */
  newyear_form_submit: ['time_known'],
  newyear_result: ['member', 'unlocked'],
  newyear_unlock_click: ['plan'],
  newyear_login_click: ['from'],
  newyear_download: ['format'],
  /** Home v3 รอบแรก (ประชุม 24 พ.ย. 2569 ข้อ 1). ทางลัด 4 ช่อง: slot = ลำดับช่อง 0-3 · target = key ของทางลัด
   *  (destiny/calendar/…) — เป็นชื่อฟีเจอร์ ไม่ใช่ข้อมูลผู้ใช้. */
  home_shortcut_open: ['slot', 'target'],
  home_shortcut_set: ['slot', 'target'],
  /** ชิป QI บนหน้าหลัก — นับการกดอย่างเดียว ไม่ส่งยอดชี */
  home_qi_chip_click: [],
  /** ป๊อปอัป "Limited time": offer = รหัสแพ็กเกจ (V2_PRO_MONTHLY ฯลฯ) · action = buy | later | close */
  promo_offer_view: ['offer'],
  promo_offer_click: ['offer', 'action'],
  taisui_wall: ['shown'],
  taisui_save_birth: ['result'],
  taisui_packet_way: ['to'],
  taisui_packet_later: ['from'],
  taisui_google: ['action'],
} as const satisfies Record<string, readonly string[]>

export type AnalyticsEventName = keyof typeof ANALYTICS_EVENTS

/** Parameter keys that must never travel, whatever list they appear in. Matched case-insensitively
 *  against the key name. Kept broad on purpose: a false refusal costs one rename, a false pass costs
 *  a PDPA incident. */
export const FORBIDDEN_PARAM_KEY = /birth|dob|bazi|element|zodiac|animal|email|mail|phone|tel|line|name|uuid|member_id|memberid|user_id|userid|token|address|ip$/i

/** Values a parameter may hold. Objects and arrays are refused so nothing structured leaks by accident. */
export type AnalyticsParamValue = string | number | boolean
