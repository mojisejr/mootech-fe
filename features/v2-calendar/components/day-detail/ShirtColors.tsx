// "สีเสื้อประจำวัน" — โทนสีเสื้อผ้าตามธาตุ 納音 (นับอิม) ของวัน (almanac.shirtColors, ตาราง 60 วันเอกสารซินแส).
//
// ดีไซน์ (เจ้าของเคาะ 2026-09-14): แต่ละสี = "ชิปสีจริง" ของคำนั้น (เขียว=เขียว แดง=แดง ขาว=ขอบเทา) อ่านเข้าใจง่าย
// แทนพื้นเขียวใหญ่แบบเก่า. label นับอิม (ธาตุ 納音) เป็นหัวเล็ก ๆ ด้านบน.
import { SectionCard } from './SectionCard'
import { COLOR_STYLE, COLOR_NEUTRAL as NEUTRAL } from './color-style'

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
