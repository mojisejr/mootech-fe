// features/v2-account/account-cta.ts — the ONE exported destination for the "สิทธิ์ของฉัน" screen (#365).
//
// Same reason as features/v2-shop/upgrade-cta.ts: a route string that lives at each call site is a string
// that drifts. The header badge, and anything that later wants to point here, import THIS.
//
// 🔴 This is a STATUS surface, not a sales one. The membership CTA (SHOP_HREF) and this are deliberately
// different destinations: "อัพเกรด" sells, "PRO" reports. #384 proved they are not one control — the shop
// screen must hide the seller while still showing the level. Pointing either one at the other re-opens that.
export const ACCOUNT_HREF = '/v2/account'
