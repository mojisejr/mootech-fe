

const getMonthTh = (month: number) => {

  const months = [
    '', // index 0, not used
    'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
    'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
  ];
  return months[month] || '';

}


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