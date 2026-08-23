// The personalised-month membership gate switch, in a module of its own (#391).
//
// WHY IT MOVED OUT OF pages/api/v2/calendar-month.ts: it used to be a `const` inside the handler, which
// meant NO test could ever reach the `if (!GATE_OPEN)` branch — the branch that decides whether a
// non-member gets a paid month. The only way to exercise it was to hand-edit the route during a review,
// i.e. prove it once and never again. #391's whole point is that the closed-gate path must be SAFE and
// must STAY safe, so that path needs a permanent test, so the switch needs a seam a test can move.
//
// 🔴 FOR WHOEVER DOES mootech-fe#293: the action is unchanged — flip this ONE boolean to false. Nothing
// else. The route reads it directly; the gate code lives there still.
//
// 🔓 TEMPORARILY OPEN (ฟีม 2026-08-05, Track B-4) — ยังไม่เปิดขายจริง → เปิด personalised month ให้ทั้ง
// free และ paid ชั่วคราว. ❗ หนี้: วันเปิดขาย แค่พลิกเป็น false ด่านสมาชิกก็กลับมาทันที. โค้ดด่านเดิมยังอยู่ครบใต้
// `if (!CALENDAR_MONTH_GATE_OPEN)` — TypeScript ยัง type-check มันอยู่ (ไม่ใช่ dead comment ที่เน่าเงียบ),
// resolveMembership ยัง import อยู่. ห้ามลบทิ้ง.
export const CALENDAR_MONTH_GATE_OPEN = true // TEMPORARY (ฟีม 2026-08-05) — flip to false ก่อนวันเปิดขาย
