// features/v2-home/components/QiChip.tsx — ชิปยอดชีข้างป้ายระดับบนหน้าหลัก (Home v3 รอบแรก · ประชุม 24 พ.ย. 2569 ข้อ 1)
// Figma "Home — UX v3": QI chip "90" อยู่แถวเดียวกับป้าย Plus/กระดิ่ง/avatar (QI ข้าง Plus) — ไม่เบียดชื่อผู้ใช้
// undefined (กำลังโหลด) = บล็อกเทา · null (อ่านกระเป๋าไม่ได้) = ไม่โชว์ ไม่โชว์ 0 ปลอม · number = ยอดจริง
import Image from 'next/image'
import Link from 'next/link'

import { track } from '@/lib/analytics/track'

export const QI_HREF = '/v2/qi'

export function QiChip({ qi }: { qi?: number | null }) {
  if (qi === null) return null
  if (qi === undefined) {
    return <span aria-hidden data-testid="home-qi-skeleton" className="h-8 w-[68px] flex-none animate-pulse rounded-full bg-v3-border-card" />
  }
  return (
    <Link href={QI_HREF} data-testid="home-qi-chip" onClick={() => track('home_qi_chip_click', {})}
      className="flex h-8 flex-none items-center gap-1 rounded-full bg-v3-qi-earn-bg pl-1.5 pr-2.5 text-[13px] font-black text-v3-navy">
      <Image src="/images/v2/qi/qi-coin.png" alt="" width={20} height={20} unoptimized />
      {qi.toLocaleString('th-TH')}
    </Link>
  )
}

export default QiChip
