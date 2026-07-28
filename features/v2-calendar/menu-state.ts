// MuMate v2 — ปฏิทินดวง · MENU-STATE contract (goo owns "which state a page shows"; Lamun owns "does
// each state render right"). One <CalendarMenu> component, FOUR states — NOT four different navs.
// Getting this wrong = rebuild the whole flow (frame §menu).
//
// ⚠️ SOURCE / CONFIDENCE (label a guess a guess — confidence travels WITH the contract):
//   COUNT(4) + Mate-AI pattern (states 1-3 have it, 4 doesn't) = VERIFIED vs Figma node 461:3224 by
//   Lamun's Phase-1 enumerate-verify: no 5th state exists, state-1 matches exactly, and the save sheet
//   has no bottom menu (confirms state 4 = no Mate AI). PENDING: the per-screen STYLING of states 2/3/4
//   is verified as Lamun builds those screens (Phase 3/4/5) — if any reveals a shape the enum can't hold
//   (a 5th state, or state 4 gains/drops beyond "no Mate AI") → STOP, route บอง→ฟีม, amend together;
//   goo re-codifies. (proxy-ladder: this enum was a proxy of "the real states in Figma"; Lamun opened
//   Figma = the ground truth, and it held for count + Mate-AI pattern.)
//
//   VALUES are string identifiers matching Lamun's existing <CalendarMenu> union (ตู๋'s #134 review) so a
//   state renders WITHOUT a numeric→string translation map: CalendarMenuState.Normal === 'default'.

/**
 * The bottom menu's 4 states across the calendar flow.
 * Left slot swaps content; the Mate AI slot (right) is present in 1-3 and ABSENT in 4.
 */
export enum CalendarMenuState {
  /** 1 · ปกติ — 4 แท็บ (หน้าหลัก/บริการ/ปฏิทิน/ร้านค้า) + Mate AI. (หน้าปฏิทินรายเดือน · หน้า home) */
  Normal = 'default',
  /** 2 · มีปุ่มหลัก — ปุ่มน้ำเงิน "เพิ่มลงปฏิทิน เพื่อแจ้งเตือน" + Mate AI. (รายละเอียดวัน · ยังไม่บันทึก · ทั้ง 2 โหมด) */
  PrimaryAction = 'primary-cta',
  /** 3 · บันทึกแล้ว — ปุ่มน้ำเงิน "✓ คุณบันทึกลงปฏิทินแล้ว" + Mate AI. (รายละเอียดวันหลังบันทึก) */
  Saved = 'saved',
  /** 4 · โหมดฟอร์ม — ปุ่ม "บันทึก" เต็มความกว้าง · ❌ ไม่มี Mate AI. (sheet บันทึกลงปฏิทิน) */
  FormMode = 'form',
}

/** Does this state show the Mate AI button? True for 1-3, false for the form sheet (4). */
export function menuHasMateAi(state: CalendarMenuState): boolean {
  return state !== CalendarMenuState.FormMode
}

/**
 * The menu state a DAY-DETAIL page implies (goo drives it): a day that already has a reminder shows
 * "บันทึกแล้ว" (3), otherwise "มีปุ่มหลัก" (2). The transition 2→3 happens after a save commits — that
 * wiring is the Phase-5 seam; this selector is the pure mapping it uses.
 */
export function menuStateForDay(hasReminder: boolean): CalendarMenuState {
  return hasReminder ? CalendarMenuState.Saved : CalendarMenuState.PrimaryAction
}

/** Label for logs/anchors — never user-facing copy (that's Lamun's). */
export const MENU_STATE_LABEL: Record<CalendarMenuState, string> = {
  [CalendarMenuState.Normal]: 'normal-4tabs',
  [CalendarMenuState.PrimaryAction]: 'primary-action',
  [CalendarMenuState.Saved]: 'saved',
  [CalendarMenuState.FormMode]: 'form-mode-no-mate-ai',
}
