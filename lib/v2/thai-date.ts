// lib/v2/thai-date.ts — 'YYYY-MM-DD' → '14 ก.ค. 2570' (day · abbreviated Thai month · BUDDHIST year).
//
// #365 needs it for "ใช้ได้ถึง …" on จอ "สิทธิ์ของฉัน". PURE and exported so a test can assert the exact
// rendered string rather than a parsed fragment — a `/(\d+)/` on the output would have read '14' from both
// a correct and a wrong month, which is the class of instrument that certifies its own bug.
//
// 🟠 SECOND COPY, KNOWN, NOT FIXED HERE: features/v2-service/components/compat-format.ts:5 has its own
// TH_MONTHS_ABBR. It should delegate to this file — but it has ZERO tests (git grep formatCompatBirth over
// scripts/ = 0 hits), so refactoring it inside this ticket would be unprotected surgery on a shipped screen
// for a change #365 does not need. Ticket instead of detour, per the rule in scripts/member-subscription.test.ts.
const TH_MONTHS_ABBR = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']

/**
 * '2027-07-14' → '14 ก.ค. 2570'. Returns '' for anything that is not a real 'YYYY-MM-DD' — the caller then
 * renders nothing rather than a half-date. ❌ NEVER falls back to "today" or to a fabricated date: on a
 * screen that tells someone how long they have paid for, an invented date is worse than a missing one.
 *
 * ⚠️ String in, string out — no Date object anywhere. Constructing `new Date('2027-07-14')` would parse as
 * UTC midnight and, rendered in Asia/Bangkok (+07), still says the 14th — but the same code one timezone
 * WEST would print the 13th. The date this screen shows must not depend on where the reader is standing.
 */
export function formatThaiDateAbbr(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!m) return ''
  const monthIdx = Number(m[2]) - 1
  if (monthIdx < 0 || monthIdx > 11) return ''
  const day = Number(m[3])
  if (day < 1 || day > 31) return ''
  return `${day} ${TH_MONTHS_ABBR[monthIdx]} ${Number(m[1]) + 543}`
}
