

const getMonthTh = (month: number) => {

  const months = [
    '', // index 0, not used
    'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
    'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
  ];
  return months[month] || '';

}

// "2026-06-01" → "1 มิถุนายน 2569" — long Thai month + Buddhist era (พ.ศ. = ค.ศ. + 543).
// Reuses getMonthTh above. Returns '' on malformed input so the caller can fall back to the raw string.
export const formatThaiLongDate = (iso: string): string => {
  if (!iso || iso.length < 10) return '';
  const [y, m, d] = iso.slice(0, 10).split('-');
  const day = parseInt(d, 10); // "01" → 1 (drops the leading zero)
  const monthTh = getMonthTh(parseInt(m, 10));
  const yearBe = parseInt(y, 10) + 543;
  if (!day || !monthTh || Number.isNaN(yearBe)) return '';
  return `${day} ${monthTh} ${yearBe}`;
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