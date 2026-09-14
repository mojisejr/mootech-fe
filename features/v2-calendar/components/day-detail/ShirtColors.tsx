// "สีเสื้อประจำวัน" — โทนสีเสื้อผ้าตามธาตุ 納音 (นับอิม) ของวัน (almanac.shirtColors, ตาราง 60 วันเอกสารซินแส).
//
// ดีไซน์ (เจ้าของเคาะ 2026-09-14): แต่ละสี = "ชิปสีจริง" ของคำนั้น (เขียว=เขียว แดง=แดง ขาว=ขอบเทา) อ่านเข้าใจง่าย
// แทนพื้นเขียวใหญ่แบบเก่า. label นับอิม (ธาตุ 納音) เป็นหัวเล็ก ๆ ด้านบน.
import { SectionCard } from './SectionCard'

// ชื่อสีไทย → { พื้นชิป, สีตัวอักษร, ขอบ? } — เลือกให้ตัวอักษรอ่านออกบนพื้น (สีอ่อน=อักษรเข้ม+ขอบ, สีเข้ม=อักษรขาว)
const COLOR_STYLE: Record<string, { bg: string; text: string; border?: string }> = {
  เขียว: { bg: '#2E9E5B', text: '#FFFFFF' },
  แดง: { bg: '#D6453A', text: '#FFFFFF' },
  ชมพู: { bg: '#F0A6BE', text: '#7A2942' },
  ส้ม: { bg: '#E8863A', text: '#FFFFFF' },
  ม่วง: { bg: '#7C5CBF', text: '#FFFFFF' },
  ครีม: { bg: '#F5ECCB', text: '#7A6A2A', border: '#E4D6A6' },
  เหลือง: { bg: '#F4CE3B', text: '#6B5410' },
  น้ำตาล: { bg: '#8A5A2B', text: '#FFFFFF' },
  ขาว: { bg: '#FFFFFF', text: '#5A5A5A', border: '#D8D8D8' },
  ฟ้า: { bg: '#7FC0EC', text: '#0F3E63' },
  น้ำเงิน: { bg: '#1F4E9E', text: '#FFFFFF' },
  เทา: { bg: '#8A929B', text: '#FFFFFF' },
  ดำ: { bg: '#2B2B2B', text: '#FFFFFF' },
}
const NEUTRAL = { bg: '#EDEFF2', text: '#3A4A5E' }

export function ShirtColors({ shirtColors }: { shirtColors?: { navin: string; colors: string[] } | null }) {
  if (!shirtColors || (!shirtColors.navin && shirtColors.colors.length === 0)) return null
  // colors[] เป็นสตริงรวมหลายคำ ("แดง ชมพู ส้ม ม่วง") → แตกเป็นคำเดี่ยว แล้วทำชิปต่อคำ
  const words = shirtColors.colors.flatMap((c) => c.split(/\s+/)).map((w) => w.trim()).filter(Boolean)

  return (
    <SectionCard
      title="สีเสื้อประจำวัน"
      testId="shirt-colors"
      info={<p className="leading-6">สวมเสื้อผ้าโทนสีตามธาตุ 納音 (นับอิม) ของวันนี้ เพื่อเสริมพลังและความราบรื่น</p>}
    >
      <div className="flex flex-col gap-2">
        {shirtColors.navin ? <p className="text-[13px] font-bold text-v3-text-muted">{shirtColors.navin}</p> : null}
        <div className="flex flex-wrap gap-1.5" data-testid="shirt-colors-chips">
          {words.map((w, i) => {
            const s = COLOR_STYLE[w] ?? NEUTRAL
            return (
              <span
                key={`${w}-${i}`}
                className="rounded-full px-2.5 py-1 text-sm font-medium leading-5"
                style={{ backgroundColor: s.bg, color: s.text, border: s.border ? `1px solid ${s.border}` : undefined }}
              >
                {w}
              </span>
            )
          })}
        </div>
      </div>
    </SectionCard>
  )
}
