// The ONE place that knows where an "upgrade / this is for members" control sends the user (#359).
//
// Before this file, four controls across three features each answered the tap by ANNOUNCING
// "ระบบสมาชิกกำลังจะมา เร็วๆ นี้" — because there was no pricing screen to send anyone to. There is now.
//
// 🔑 Why a constant rather than four literals: the previous arrangement had the same sentence typed into
// two different files (YamTimes.tsx `YAM_LOCKED_MESSAGE` and tier-lock.ts `DAY_CTA_LOCKED_MESSAGE`), which
// had to be kept in sync by hand. `lib/usage-core.ts:23` records that this repo has had that shape before,
// at three copies. One exported destination cannot drift from itself.
//
// 🔴 This is for the MEMBERSHIP path only. The other coming-soon controls (profile, the ten unbuilt
// services, photo upload) are NOT about membership and must keep announcing — sending them here would
// offer to sell someone a plan when they tapped "โปรไฟล์".

/** Where every membership CTA goes. */
export const SHOP_HREF = '/v2/shop'

/** Accessible name shared by the locked reminder controls, so the label cannot drift per call site. */
export const UPGRADE_TO_MEMBER_LABEL = 'ดูแพ็กเกจสมาชิก'
