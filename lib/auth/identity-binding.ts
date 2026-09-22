// Pure decision for the home register-login identity gate, with MEMBER_SUB binding.
//
// ⚠️ บทเรียน revert #755/#760: ห้ามบังคับ re-register ผู้ใช้เดิมที่ยังไม่มี MEMBER_SUB (ทำให้ทุกคนค้างโหลด).
// กติกาปลอดภัย:
//   - ไม่มี MEMBER_ID           → "register" (first login / after wipe)
//   - มี MEMBER_ID + boundSub ต่าง currentSub จริง (ทั้งคู่ไม่ว่าง) → "clear-and-register" (cookie ค้างข้ามบัญชี)
//   - นอกนั้น (ตรง sub หรือ boundSub ว่าง หรือ currentSub ว่างชั่วขณะ) → "hydrate" (fast path เดิม + backfill sub เงียบ ๆ)
//
// NB: ต้องเป็น "hydrate" เสมอเมื่อ boundSub ว่าง — นี่คือ path ของผู้ใช้เดิมทั้งหมด (cookie ยังไม่ผูก sub).

export type IdentityAction = "register" | "clear-and-register" | "hydrate";

export function nextIdentityAction(
  hasMemberId: boolean,
  currentSub: string | null | undefined,
  boundSub: string | null | undefined,
): IdentityAction {
  if (!hasMemberId) return "register";
  const cur = (currentSub ?? "").trim();
  const bound = (boundSub ?? "").trim();
  if (cur && bound && bound !== cur) return "clear-and-register";
  return "hydrate";
}

/** ควร backfill MEMBER_SUB เงียบ ๆ ไหม (มี MEMBER_ID, ยังไม่ผูก sub, และรู้ sun ปัจจุบัน) — ไม่ยิง network */
export function shouldBackfillSub(
  hasMemberId: boolean,
  currentSub: string | null | undefined,
  boundSub: string | null | undefined,
): boolean {
  return hasMemberId && !(boundSub ?? "").trim() && !!(currentSub ?? "").trim();
}
