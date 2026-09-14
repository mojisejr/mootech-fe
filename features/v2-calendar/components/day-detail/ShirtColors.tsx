// "สีเสื้อประจำวัน" — โทนสีเสื้อผ้าตามธาตุ 納音 (นับอิม) ของวัน (almanac.shirtColors, ตาราง 60 วันเอกสารซินแส).
//
// ดีไซน์ตามไฟล์ซินแส "ตัวอักษรขาว พื้นตามสีนับอิม": พื้นการ์ด = สีตามธาตุนับอิมของวัน, ตัวอักษร = สีขาว.
// ต่างจากการ์ด "ทิศ สีมงคล" (LuckyColors) ที่ใช้ almanac.colors — อันนี้คือสีเสื้อตาม 納音 โดยเฉพาะ.
//
// hex ไม่มีในเอกสาร (มีแต่ชื่อธาตุ+ชื่อสี) → ใช้เฉดธาตุเข้มพอให้ตัวอักษรขาวอ่านออก (WCAG ≥4.5:1 บนพื้น).
import { SectionCard } from './SectionCard'

// ธาตุนับอิม → สีพื้น (เข้มพอสำหรับตัวอักษรขาว). ทอง = เทาเงิน (พื้นขาวจะทำตัวอักษรขาวหาย), น้ำ = น้ำเงินเข้ม.
const NAVIN_BG: Record<string, string> = {
  ไม้: '#2E9E5B', // เขียว (wood)
  ไฟ: '#D6453A', // แดง (fire)
  ดิน: '#A9803A', // น้ำตาล/โอ๊ก (earth)
  ทอง: '#8A929B', // เทาเงิน (metal — ตัวอักษรขาวต้องอ่านออก จึงไม่ใช้ขาวล้วน)
  น้ำ: '#1F6BB0', // น้ำเงินเข้ม (water)
}

/** "นับอิมทอง" → "ทอง". null ถ้าไม่รู้จักธาตุ */
function elementOf(navin: string): string | null {
  const m = navin.replace(/^นับอิม/, '').trim()
  return m in NAVIN_BG ? m : null
}

export function ShirtColors({ shirtColors }: { shirtColors?: { navin: string; colors: string[] } | null }) {
  if (!shirtColors || (!shirtColors.navin && shirtColors.colors.length === 0)) return null
  const el = elementOf(shirtColors.navin)
  const bg = el ? NAVIN_BG[el] : '#464646'

  return (
    <SectionCard
      title="สีเสื้อประจำวัน"
      testId="shirt-colors"
      info={
        <p className="leading-6">
          สวมเสื้อผ้าโทนสีตามธาตุ 納音 (นับอิม) ของวันนี้ เพื่อเสริมพลังและความราบรื่น
        </p>
      }
    >
      <div
        data-testid="shirt-colors-panel"
        className="flex flex-col gap-2 rounded-2xl px-4 py-3.5 text-white"
        style={{ backgroundColor: bg }}
      >
        {shirtColors.navin ? <p className="text-sm font-bold opacity-95">{shirtColors.navin}</p> : null}
        <div className="flex flex-wrap gap-1.5">
          {shirtColors.colors.map((c, i) => (
            <span
              key={`${c}-${i}`}
              className="rounded-full bg-white/20 px-2.5 py-1 text-sm font-medium leading-5 text-white"
            >
              {c}
            </span>
          ))}
        </div>
      </div>
    </SectionCard>
  )
}
