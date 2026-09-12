// §13 [advanced] "10 เทพ 十神 · คีย์เวิร์ด" — the deity rows: chip + name + "·"-joined keywords.
// ระบบเป็น 十神 (10 เทพ ตามตำราซินแส) — ข้อมูลรายวันจากคี้มึ้งใช้ 8 ตัว/วัน (天地玄虎合陰蛇符); ป้ายหัวข้อเรียก "10 เทพ".
//
// M-D (มุน 2026-08-06): the frozen version carried a 神 glyph (天·符·蛇…) in a square chip alongside the
// Thai name. The pipe sends `{name, keywords}` and NO glyph. Typing the glyphs back in from the old fixture
// would re-freeze content the source does not provide, so the chip is gone rather than faked.
//
// The first attempt kept the chip and filled it with `name.slice(0, 1)`. Looking at the render killed it:
// Thai leading vowels cannot stand alone, so เทียน · เสอ · เหอ · เฉิน · เชวี่ย all rendered as a bare "เ"
// — five identical chips that read as a font bug. A character count is not a character.
import type { DayDetailSpirit } from '../../types'
import { SectionCard } from './SectionCard'

// ชิปอักษร + สี. ชื่อไทยของเทพ = ตามเอกสารซินแส 十神 (FIXเงื่อนไขปฏิทิน, 2026-09-12) — เป็นสำเนียงแต้จิ๋วของซินแส
// (ที/ตี่/เหี่ยงบู้/แปะโฮ่ว/ฮะ/อิม/จั๊ว/ฮู้/กาวทิ้ง/จูเฉียก) แทนสำเนียงจีนกลางเดิมของ Figma เพื่อให้ตรงตำรา
// และตรงกับชื่อเทพที่โชว์ในตารางประตู (EightGates). pipe ส่ง name เป็นอักษรจีนตัวเดียว — ไม่รู้จัก = ชิปน้ำเงินอ่อน + ชื่อดิบ
export const SPIRIT_STYLE: Record<string, { th: string; bg: string; ink: string }> = {
  '天': { th: 'ที', bg: '#EAF0FA', ink: '#1455A4' },
  '地': { th: 'ตี่', bg: '#EAF0FA', ink: '#1455A4' },
  '玄': { th: 'เหี่ยงบู้', bg: '#EEF0F3', ink: '#464646' },
  '虎': { th: 'แปะโฮ่ว', bg: '#FDECE9', ink: '#CD3D2E' },
  '合': { th: 'ฮะ', bg: '#E7F6F8', ink: '#1B9AAF' },
  '陰': { th: 'อิม', bg: '#F1EFFA', ink: '#AF9CE0' },
  '蛇': { th: 'จั๊ว', bg: '#FDECE9', ink: '#CD3D2E' },
  '符': { th: 'ฮู้', bg: '#E7F6F8', ink: '#1B9AAF' },
  '陳': { th: 'กาวทิ้ง', bg: '#EEF0F3', ink: '#464646' },
  '雀': { th: 'จูเฉียก', bg: '#FEF3E5', ink: '#B47E35' },
}

export function EightDeities({ deities }: { deities: DayDetailSpirit[] }) {
  return (
    <SectionCard title="10 เทพ 十神 · คีย์เวิร์ด · เรื่องราว" testId="eight-deities">
      <ul className="flex flex-col gap-3.5">
        {deities.length === 0 && <li className="text-sm text-v3-text-muted">วันนี้ไม่มีข้อมูล 10 เทพ</li>}
        {deities.map((d, i) => (
          <li key={`${d.name}-${i}`} data-testid="deity-row" className="flex items-start gap-3">
            <span
              aria-hidden
              data-testid="deity-glyph"
              className="grid size-9 shrink-0 place-items-center rounded-[10px] text-[16px] font-bold leading-none"
              style={{ backgroundColor: (SPIRIT_STYLE[d.name.trim()] ?? { bg: '#EAF0FA' }).bg, color: (SPIRIT_STYLE[d.name.trim()] ?? { ink: '#1455A4' }).ink }}
            >
              {d.name.trim().slice(0, 1)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-v3-navy">{SPIRIT_STYLE[d.name.trim()]?.th ?? d.name}</p>
              <p className="mt-0.5 text-xs leading-5 text-v3-text-body">{d.keywords.join(' · ')}</p>
            </div>
          </li>
        ))}
      </ul>
    </SectionCard>
  )
}
