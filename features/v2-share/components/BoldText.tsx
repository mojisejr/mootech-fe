// features/v2-share/components/BoldText.tsx — เรนเดอร์ **bold** (มาร์กดาวน์จาก engine) เป็นตัวหนาสีเข้ม (navy).
// เอ็ม 2026-09-26: หัวข้อในดอกจัน เช่น "**ดิถี 己 (ดิน) · อ่อนเกินไป**" ต้องเป็นตัวเข้ม ทั้งหน้าแชร์และหน้าดวงจริง
//   (เดิม share โชว์ ** ดิบ, destiny จริง stripMd ทิ้ง ** เหลือ text สีเทา). ใช้ร่วมทั้ง 2 ที่.
//   คงบรรทัด/ช่องว่างด้วย whitespace-pre-line ที่ <p> ตัวครอบ (renderer นี้คืน node ไม่แตะ newline).
import React from 'react'

/** แตกข้อความเป็น node: ส่วนที่อยู่ใน **...** → <strong> สีเข้ม, ส่วนอื่นคงเดิม (สืบสีจาก <p> ที่ครอบ) */
export function renderBoldSegments(text: string): React.ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((seg, i) => {
    const m = seg.match(/^\*\*([^*]+)\*\*$/)
    return m ? (
      <strong key={i} className="font-bold text-v3-navy">{m[1]}</strong>
    ) : (
      <React.Fragment key={i}>{seg}</React.Fragment>
    )
  })
}

export function BoldText({ text, className }: { text: string; className?: string }) {
  return <p className={className}>{renderBoldSegments(text)}</p>
}

export default BoldText
