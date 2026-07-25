

const getMonthTh = (month: number) => {

  const months = [
    '', // index 0, not used
    'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
    'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
  ];
  return months[month] || '';

}

// "2026-06-01" → "1 มิถุนายน 2569" — long Thai month + Buddhist era (พ.ศ. = ค.ศ. + 543).
// Reuses getMonthTh above. Returns '' on ANY malformed/impossible input (caller decides the fallback).
// STRICT (goo's runtime catch): shape guard + Date round-trip, so out-of-range days and impossible dates
// — 2026-06-31 (June has 30d), 2026-06-99, 2026-13-01 — all fail the equality check instead of leaking
// "99 มิถุนายน 2569". new Date(y, m-1, d) rolls invalid dates over, so the components won't match.
export const formatThaiLongDate = (iso: string): string => {
  if (!/^\d{4}-\d{2}-\d{2}/.test(iso)) return ''; // strict ISO date shape (rejects "2026/06/01", short, "1x")
  const [y, m, d] = iso.slice(0, 10).split('-').map((s) => parseInt(s, 10));
  const dt = new Date(y, m - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return '';
  const monthTh = getMonthTh(m);
  if (!monthTh) return '';
  return `${d} ${monthTh} ${y + 543}`;
};


export const formatDateTime = (dob: string) => {
  if (dob.length != 10) { //2024-07-24
    return ''
  }
  const arrayDob = dob.split('-')
  if (arrayDob.length != 3) {
    return ''
  }

  const date = arrayDob[2];
  const monthTh =arrayDob[1]
  const yearTh = parseInt(arrayDob[0])+543;

  return `${date}/${monthTh}/${yearTh}`
}


export const formatDateAndTime = (dateStr: string) => {
  const dateArray = dateStr.split(' ')

  const dob = dateArray[0]

  if (dob.length != 10) { //2024-07-24
    return ''
  }
  const arrayDob = dob.split('-')
  if (arrayDob.length != 3) {
    return ''
  }

  const date = arrayDob[2];
  const monthTh =arrayDob[1]
  const yearTh = parseInt(arrayDob[0])+543;


  const time = dateArray[1]

  return `${date}/${monthTh}/${yearTh} (${time})`
}