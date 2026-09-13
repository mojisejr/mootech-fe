// [advanced] "กุ้ยนั้ง 貴人 · คนอุปถัมภ์วันนี้" — ปีนักษัตรของคนที่ตำราบอกว่าเป็นผู้อุปถัมภ์ (貴人) ในวันนั้น
// ข้อมูล = almanac.patrons[].zodiac ดิบ ("คนเกิดปีวอก") จาก engine — ไม่มีในเฟรม Figma 634:8752; gafiw ขอเพิ่มในโหมด
// แอดวานซ์ (2026-09-07) สไตล์ตาม SectionCard เดียวกับส่วนอื่น ไม่แปล/ไม่จัดอันดับ
import { SectionCard } from './SectionCard'

const ZODIAC_EMOJI: Record<string, string> = {
  ชวด: '🐭', ฉลู: '🐮', ขาล: '🐯', เถาะ: '🐰', มะโรง: '🐲', มะเส็ง: '🐍',
  มะเมีย: '🐴', มะแม: '🐐', วอก: '🐵', ระกา: '🐔', จอ: '🐶', กุน: '🐷',
}
const zodiacOf = (label: string) => Object.keys(ZODIAC_EMOJI).find((z) => label.includes(z))

export function Patrons({ patrons }: { patrons: string[] }) {
  return (
    <SectionCard
      title="กุ้ยนั้ง 貴人 · คนอุปถัมภ์วันนี้"
      testId="patrons"
      info={<p>คนที่เกิดปีนักษัตรเหล่านี้เป็น “กุ้ยนั้ง” (ผู้อุปถัมภ์) ของวันนี้ตามตำรา — ติดต่อ ขอความช่วยเหลือ หรือร่วมงานกับคนกลุ่มนี้จะราบรื่นกว่า</p>}
    >
      {patrons.length === 0 ? (
        <p className="text-sm text-v3-text-muted">วันนี้ไม่มีข้อมูลกุ้ยนั้ง</p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {patrons.map((p, i) => {
            const z = zodiacOf(p)
            return (
              <li key={`${p}-${i}`} data-testid="patron-chip" className="flex items-center gap-2 rounded-full bg-v3-sapphire-tint py-2 pl-3 pr-4 text-sm font-bold text-v3-sapphire">
                {z ? <span aria-hidden className="text-lg leading-none">{ZODIAC_EMOJI[z]}</span> : null}
                {p}
              </li>
            )
          })}
        </ul>
      )}
    </SectionCard>
  )
}
