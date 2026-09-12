// features/v2-service/components/ResultActionBar.tsx — แถวลอยติดล่างของหน้าผลสมพงศ์ (Figma 720:26015 / 636:18819 §Frame2147223879)
//   "บันทึก PDF" bg #1B9AAF · "แชร์" bg #1455A4 · h56 · r100 · ไอคอน 20 (asset จาก Figma) + 16 bold #E1FF00 · เงา 0 6 14 (สี .24)
//   + Mate AI (MateAIButton) ทางขวา — ไม่มี 4 แท็บ (Figma วาดเฉพาะ Navbar Mate AI)
// ผู้ใช้เคาะ 2026-09-07: ทำ UI ตาม Figma — แชร์ = Web Share API (fallback คัดลอกลิงก์) · PDF = "เร็ว ๆ นี้" จนกว่าจะมี API
import Image from 'next/image'
import { MateAIButton } from '@/features/v2-shell/components/MateAIButton'
import { announceComingSoon } from '@/features/v2-shell/components/ComingSoon'
import { shareAsInvite } from '@/lib/v2/share-invite'

// แชร์ผล = ลิงก์เชิญเพื่อนของ user เอง (คนสมัคร → user ได้ QI) แทน url หน้าปัจจุบันที่ติด v2 gate (ผู้ใช้ 2026-09-12)
export async function shareResult(text: string) {
  const r = await shareAsInvite({ title: 'ผลความสมพงศ์', text })
  if (r === 'copied') announceComingSoon('คัดลอกลิงก์แล้ว')
}

/**
 * inline=true  → แถวปุ่ม PDF/แชร์ วางในเนื้อหา (ใต้การ์ด hero ตามเฟรม 720:29221) ไม่มี Mate AI
 * inline=false → ตัวลอยติดล่าง: เหลือแค่ Mate AI (ปุ่มคู่ย้ายขึ้นไป inline แล้ว — ไม่โชว์ซ้ำ 2 ที่)
 * ไม่ส่ง inline → พฤติกรรมเดิม (ปุ่มคู่ + Mate AI ลอยล่าง) สำหรับหน้าคู่รักที่ยังใช้แบบเดิม
 */
export function ResultActionBar({ shareText, testIdPrefix = 'work', inline }: { shareText: string; testIdPrefix?: string; inline?: boolean }) {
  if (inline === false) {
    return (
      <div className="fixed inset-x-0 bottom-0 z-40 mx-auto flex max-w-md items-center justify-end px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2">
        <MateAIButton />
      </div>
    )
  }
  return (
    <div className={inline ? 'flex items-center gap-2' : 'fixed inset-x-0 bottom-0 z-40 mx-auto flex max-w-md items-center gap-2 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2'}>
      <div className="flex min-w-0 flex-1 items-center gap-1">
        <button
          type="button"
          data-testid={`${testIdPrefix}-pdf`}
          onClick={() => announceComingSoon('บันทึกเป็น PDF กำลังจะมา เร็ว ๆ นี้')}
          className={`flex ${inline ? 'h-14' : 'h-[70px]'} min-w-0 flex-1 items-center justify-center gap-2 rounded-[100px] bg-v3-cyan text-[16px] font-bold text-v3-lime shadow-[0_6px_14px_rgba(27,154,175,0.24)]`}
        >
          <Image src="/images/v2/compat/work/pdf.svg" alt="" width={20} height={20} className="size-5" />
          บันทึก PDF
        </button>
        <button
          type="button"
          data-testid={`${testIdPrefix}-share`}
          onClick={() => void shareResult(shareText)}
          className={`flex ${inline ? 'h-14' : 'h-[70px]'} min-w-0 flex-1 items-center justify-center gap-2 rounded-[100px] bg-v3-sapphire text-[16px] font-bold text-v3-lime shadow-[0_6px_14px_rgba(20,85,164,0.24)]`}
        >
          <Image src="/images/v2/compat/work/share.svg" alt="" width={20} height={20} className="size-5" />
          แชร์
        </button>
      </div>
      {inline ? null : <MateAIButton />}
    </div>
  )
}

export default ResultActionBar
