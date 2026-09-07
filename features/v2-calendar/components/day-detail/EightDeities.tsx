// §13 [advanced] "8 เทพ 八神 · คีย์เวิร์ด" — the 8 deity rows: chip + name + "·"-joined keywords.
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

// ชิปอักษร + สีตามเฟรม Figma 634:8752 (design context 2026-09-07; ผู้ใช้สั่งใส่สี). ชื่อไทยตามเฟรมเดียวกัน.
// pipe ส่ง name เป็นอักษรจีนตัวเดียว (天 符 蛇 陰 合 陳 雀 地) — ไม่รู้จัก = ชิปน้ำเงินอ่อน + ชื่อดิบ
export const SPIRIT_STYLE: Record<string, { th: string; bg: string; ink: string }> = {
  '天': { th: 'เทียน', bg: '#EAF0FA', ink: '#1455A4' },
  '符': { th: 'ฟู้', bg: '#E7F6F8', ink: '#1B9AAF' },
  '蛇': { th: 'เสอ', bg: '#FDECE9', ink: '#CD3D2E' },
  '陰': { th: 'อิน', bg: '#F1EFFA', ink: '#AF9CE0' },
  '合': { th: 'เหอ', bg: '#E7F6F8', ink: '#1B9AAF' },
  '陳': { th: 'เฉิน', bg: '#EEF0F3', ink: '#464646' },
  '雀': { th: 'เชวี่ย', bg: '#FEF3E5', ink: '#B47E35' },
  '地': { th: 'ตี้', bg: '#EAF0FA', ink: '#1455A4' },
}

export function EightDeities({ deities }: { deities: DayDetailSpirit[] }) {
  return (
    <SectionCard title="8 เทพ 八神 · คีย์เวิร์ด" testId="eight-deities">
      <ul className="flex flex-col gap-3.5">
        {deities.length === 0 && <li className="text-sm text-v3-text-muted">วันนี้ไม่มีข้อมูล 8 เทพ</li>}
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
