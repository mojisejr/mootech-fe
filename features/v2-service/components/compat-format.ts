// features/v2-service/components/compat-format.ts — the profile-row date line, Figma 636:18670
// "14 มิ.ย. 2537 · 09:30 น." — day + ABBREVIATED Thai month + Buddhist year, then "· HH:mm น." when a birth
// time is known. Pure + exported so the harness can assert the exact rendered string. dob is 'YYYY-MM-DD'
// (goo), time is 'HH:mm' | '' (empty = birth time not remembered → drop the "· …น." tail, never fabricate).
const TH_MONTHS_ABBR = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']

/** '1994-06-14' + '09:30' → '14 มิ.ย. 2537 · 09:30 น.' · empty dob → '' · empty time → '14 มิ.ย. 2537' */
export function formatCompatBirth(dob: string, time: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dob)
  if (!m) return ''
  const year = Number(m[1]) + 543 // CE → BE
  const monthIdx = Number(m[2]) - 1
  const day = Number(m[3])
  if (monthIdx < 0 || monthIdx > 11) return ''
  const date = `${day} ${TH_MONTHS_ABBR[monthIdx]} ${year}`
  return time ? `${date} · ${time} น.` : date
}
