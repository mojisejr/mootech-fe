// MuMate v2 · reminder fire-time (goo · #287). PURE — no DB, no network — so the mutants can be fired
// without a server. This is the ตู๋-heavy correctness core: get the instant wrong and every reminder
// fires 7 hours off, silently.
//
// THE RULES (goo วางเองตอนปรึกษา, เข้าเป็นข้อบังคับของใบ):
//   • fire = 30 นาที ก่อน "เวลาเริ่ม" ยาม  — anchor ที่ START เสมอ
//   • Asia/Bangkok → UTC, เก็บเป็น instant สัมบูรณ์  — คำนวณครั้งเดียวตอนบันทึก
//   • ❌ ห้ามบวกลบ "HH:MM" ด้วยมือ  → เราสร้าง instant (ISO + offset) แล้วลบ "มิลลิวินาที" ให้ date
//     arithmetic ม้วนข้ามเที่ยงคืน/ข้ามวัน/ข้ามเดือน ให้เอง
//
// WHY A LITERAL +07:00 (not a tz library): Asia/Bangkok has been a FIXED UTC+7 since the 1920s and has
// never observed DST — there is no offset that varies by date, so an offset-qualified ISO instant is
// EXACT. The repo ships no tz lib; pulling one in for a constant offset would be dead weight. If
// Thailand ever adopted DST this constant is the one place to revisit (documented on purpose).

export const REMINDER_LEAD_MINUTES = 30;
const BANGKOK_OFFSET = "+07:00";

/** "HH:MM-HH:MM" → the START "HH:MM", or null if malformed / out of range. */
export function windowStart(window: string): string | null {
  const m = /^(\d{2}):(\d{2})-(\d{2}):(\d{2})$/.exec(window.trim());
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (hh > 23 || mm > 59) return null;
  return `${m[1]}:${m[2]}`;
}

/** Read back a UTC instant as its Asia/Bangkok wall date "YYYY-MM-DD" (shift +7h, then read UTC parts). */
function bangkokDate(instant: Date): string {
  return new Date(instant.getTime() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
}
/** Read back a UTC instant as its Asia/Bangkok wall time "HH:MM". */
function bangkokTime(instant: Date): string {
  return new Date(instant.getTime() + 7 * 60 * 60 * 1000).toISOString().slice(11, 16);
}

/**
 * The absolute UTC instant to notify — 30 min before the yam START — or null if inputs are malformed.
 *
 * @param date    "YYYY-MM-DD" — the yam START's calendar day in Asia/Bangkok. A midnight-crossing yam
 *                (e.g. y5 "23:00-00:59") belongs to its START's date: on D it fires D 22:30 (same day),
 *                NOT D-1. Pinning to START is what makes that true.
 * @param window  "HH:MM-HH:MM"
 */
export function computeFireAt(date: string, window: string): Date | null {
  const d = date.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return null;
  const start = windowStart(window);
  if (start === null) return null;

  // Build the START as an offset-qualified instant.
  const startInstant = new Date(`${d}T${start}:00${BANGKOK_OFFSET}`);
  if (Number.isNaN(startInstant.getTime())) return null;

  // Round-trip guard: JS Date silently rolls impossible dates (2026-02-30 → Mar 2, and would let a
  // date like 2026-99-99 slip if the engine were lenient). If the parsed instant doesn't render back
  // to the SAME Bangkok date+time we were given, the input was not a real calendar moment → reject.
  if (bangkokDate(startInstant) !== d || bangkokTime(startInstant) !== start) return null;

  // Subtract the lead as MILLISECONDS — this is where day/month rollback happens for free.
  return new Date(startInstant.getTime() - REMINDER_LEAD_MINUTES * 60 * 1000);
}

/**
 * Has the notify instant already passed? The ③ "ตั้งย้อนหลัง = ปฏิเสธ" guard. A reminder whose fire
 * time is now-or-past must NOT be saved (a saved reminder MUST mean a scheduled push — else the screen
 * lies). `now` is injectable so the test is deterministic.
 */
export function isFireTimePast(fireAt: Date, now: Date = new Date()): boolean {
  return fireAt.getTime() <= now.getTime();
}
