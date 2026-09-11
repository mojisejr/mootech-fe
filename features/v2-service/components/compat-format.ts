// features/v2-service/components/compat-format.ts — the profile-row date line, Figma 636:18670
// "14 มิ.ย. 2537 · 09:30 น." — day + ABBREVIATED Thai month + Buddhist year, then "· HH:mm น." when a birth
// time is known. Pure + exported so the harness can assert the exact rendered string. dob is 'YYYY-MM-DD'
// (goo), time is 'HH:mm' | '' (empty = birth time not remembered → drop the "· …น." tail, never fabricate).
// P3-17: date part delegates to the single canonical helper (lib/v2/thai-date.ts) — no more duplicated
// TH_MONTHS_ABBR / +543 here.
import { formatThaiDateAbbr } from '@/lib/v2/thai-date'

/** '1994-06-14' + '09:30' → '14 มิ.ย. 2537 · 09:30 น.' · empty dob → '' · empty time → '14 มิ.ย. 2537' */
export function formatCompatBirth(dob: string, time: string): string {
  const date = formatThaiDateAbbr(dob)
  if (!date) return ''
  return time ? `${date} · ${time} น.` : date
}
