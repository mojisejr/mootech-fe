// ฟอร์แมตวันที่/เวลาแบบไทยสำหรับ "row picker" (edit-birth) — เดือนเต็ม + พ.ศ. ตาม Figma ("15 มกราคม 2527")
const THAI_MONTHS_FULL = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
]

/** "1984-01-15" → "15 มกราคม 2527" (พ.ศ.); "" → คืน "" (ให้ผู้เรียกโชว์ placeholder) */
export function thaiDateFull(iso?: string | null): string {
  if (!iso) return ""
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number)
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d) || m < 1 || m > 12) return iso
  return `${d} ${THAI_MONTHS_FULL[m - 1]} ${y + 543}`
}

/** "09:30" → "09:30 น."; "" → "" */
export function thaiTimeLabel(hhmm?: string | null): string {
  if (!hhmm) return ""
  return `${hhmm} น.`
}
