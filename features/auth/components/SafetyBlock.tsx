import { cn } from '@/lib/utils/cn'

// SafetyBlock — MuMate v2 "ปลอดภัย 100%" reassurance (DESIGN.md v3 §7, Figma 302-275).
// Glass block (a §4-sanctioned depth moment): white@65% + backdrop-blur 22 + 1px border-card,
// radius 16, pad 24, gap 12. Title Bold 16/24 + body #888 (text-detail) 14/22.
export function SafetyBlock({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'flex flex-col gap-3 rounded-card border border-v3-border-card p-6',
        'bg-white/65 backdrop-blur-[22px]',
        className,
      )}
    >
      <p className="font-ibm text-base font-bold leading-6 text-[#444]">
        🔐 ปลอดภัย 100%
      </p>
      <p className="font-ibm text-sm leading-[22px] text-v3-text-detail">
        ข้อมูลที่คุณให้มา เราใช้แค่คำนวณดวงเท่านั้น ไม่เปิดเผย ไม่แชร์
        เก็บไว้อย่างปลอดภัย
      </p>
    </div>
  )
}

export default SafetyBlock
