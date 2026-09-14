// แชทตั้งเตือนจากวันมงคล (ซินแสนุ้ย 2026-09-14): เมื่อผู้ใช้ถาม "วันไหนดี/ฤกษ์" แล้วเสี่ยวมู่ตอบเป็นวันจริง
// (engine ground ด้วย man-vs-day → ตอบวันไทย เช่น "30 กันยายน 2569"), FE ดึงวันเหล่านั้นออกมาทำปุ่ม 🔔
// ให้กดไปตั้งเตือนที่หน้ารายละเอียดวันได้เลย. ทั้งหมด parse ฝั่ง FE จากข้อความคำตอบ — ไม่ต้องแก้ engine.

const THAI_MONTHS = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
]

// คำถามเลือกวันดี — มิเรอร์ isGoodDayQuestion ของ engine (reading-bridge.ts) + คำใช้งานจริง
const GOOD_DAY_RE = /วันไหน|วันดี|วันมงคล|ฤกษ์|ดีสุด|วันที่ดี|มงคล|ขึ้นบ้าน|ออกรถ|แต่งงาน|เปิดร้าน|เซ็นสัญญา|ย้าย/

export function isGoodDayQuestion(text: string | null | undefined): boolean {
  return typeof text === 'string' && GOOD_DAY_RE.test(text)
}

const pad = (n: number) => String(n).padStart(2, '0')

/** ดึงวันที่ไทย ("30 กันยายน 2569") จากข้อความ → ISO ("2026-09-30"). dedup, เรียง, เฉพาะที่ valid.
 *  รองรับปี พ.ศ. (>=2400 → −543) และ ค.ศ. */
export function parseThaiDates(text: string, now: Date = new Date()): string[] {
  if (typeof text !== 'string') return []
  // ปีอ้างอิงสำหรับวันที่ที่ไม่ระบุปี (เช่น "23 กันยายน") — ใช้ปีแรกที่พบในข้อความ ไม่งั้นปีปัจจุบัน
  const yearHit = /(\d{4})/.exec(text)
  let defaultYear = now.getFullYear()
  if (yearHit) {
    const y = Number(yearHit[1])
    defaultYear = y >= 2400 ? y - 543 : y
  }
  const monthAlt = THAI_MONTHS.join('|')
  const re = new RegExp(`(\\d{1,2})\\s*(${monthAlt})(?:\\s*(\\d{4}))?`, 'g')
  const seen: Record<string, true> = {}
  const out: string[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    const day = Number(m[1])
    const monthIdx = THAI_MONTHS.indexOf(m[2])
    let year = m[3] ? Number(m[3]) : defaultYear
    if (year >= 2400) year -= 543 // พ.ศ. → ค.ศ.
    if (monthIdx < 0 || day < 1 || day > 31) continue
    // ตรวจว่าวันจริง (กัน 31 ก.พ. ฯลฯ)
    const d = new Date(Date.UTC(year, monthIdx, day))
    if (d.getUTCFullYear() !== year || d.getUTCMonth() !== monthIdx || d.getUTCDate() !== day) continue
    const iso = `${year}-${pad(monthIdx + 1)}-${pad(day)}`
    if (!seen[iso]) {
      seen[iso] = true
      out.push(iso)
    }
  }
  return out.sort()
}

/** ป้ายสั้นบนชิป: ISO → "30 ก.ย." */
const THAI_MONTHS_SHORT = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']
export function shortThaiDate(iso: string): string {
  const [, mm, dd] = iso.split('-').map(Number)
  return `${dd} ${THAI_MONTHS_SHORT[(mm ?? 1) - 1] ?? ''}`.trim()
}
