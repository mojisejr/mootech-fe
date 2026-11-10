// features/v2-shell/components/MemberLock.tsx — gafiw 2026-11-10: ล็อกเนื้อหาสำหรับบัญชีฟรี (หน้าดวงของฉัน)
// locked → เนื้อหาเบลอ (กดไม่ได้/เลือกข้อความไม่ได้) + ป้าย 🔒 ทับ; แตะตรงไหนก็เปิด DestinyUpsellModal → /v2/shop
import { useState, type ReactNode } from "react"
import Link from "next/link"
import { SHOP_HREF } from "@/features/v2-shop/upgrade-cta"

/** ป็อปอัปชวนสมัคร (ข้อความ + ราคาตาม gafiw 2026-11-10: รายเดือน 99 → เดือนแรกลด 50% เหลือ 49) */
export function DestinyUpsellModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-6" role="dialog" aria-modal="true" aria-label="ปลดล็อกข้อมูลดวงเชิงลึก">
      <button type="button" aria-label="ปิด" onClick={onClose} className="absolute inset-0 bg-black/40" />
      <div className="relative w-full max-w-xs rounded-3xl bg-white p-6 text-center shadow-xl" data-testid="destiny-upsell-modal">
        <div className="mx-auto grid size-14 place-items-center rounded-full bg-v3-lime/25 text-3xl">🔮</div>
        <p className="mt-3 text-lg font-bold leading-7 text-v3-navy">ดวงของคุณยังมีอะไรให้ค้นหาอีก!</p>
        <p className="mt-1.5 text-sm leading-5 text-v3-text-muted">
          ปลดล็อกข้อมูลดวงเชิงลึก เพื่อให้คุณเข้าใจตัวเองมากขึ้น และใช้วางแผนเรื่องสำคัญในชีวิต
        </p>
        <div className="mt-4 rounded-2xl bg-v3-ghost-white px-4 py-3">
          <p className="text-[12px] font-semibold text-v3-text-muted">สมาชิกรายเดือน</p>
          <p className="mt-0.5 flex items-baseline justify-center gap-2">
            <span className="text-[15px] text-v3-text-muted line-through">99 บาท</span>
            <span className="text-[26px] font-black text-v3-sapphire">49 บาท</span>
          </p>
          <span className="mt-1 inline-block rounded-full bg-[#ff6b4a] px-2.5 py-0.5 text-[11px] font-bold text-white">ลด 50% เดือนแรก</span>
        </div>
        <div className="mt-5 flex gap-3">
          <button type="button" onClick={onClose} className="flex-1 rounded-full border border-v3-sapphire px-4 py-2.5 text-sm font-semibold text-v3-sapphire">
            ไว้ก่อน
          </button>
          <Link href={SHOP_HREF} data-testid="destiny-upsell-cta" className="flex-1 rounded-full bg-v3-sapphire px-4 py-2.5 text-sm font-semibold text-v3-lime">
            สมัครเลย
          </Link>
        </div>
      </div>
    </div>
  )
}

export function MemberLock({ locked, children, testId }: { locked: boolean; children: ReactNode; testId?: string }) {
  const [open, setOpen] = useState(false)
  if (!locked) return <>{children}</>
  return (
    <div className="relative" data-testid={testId ?? "member-lock"}>
      <div aria-hidden className="pointer-events-none select-none blur-[5px]">{children}</div>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="absolute inset-0 grid place-items-center rounded-[20px] bg-white/30"
        aria-label="ปลดล็อกสำหรับสมาชิก"
      >
        <span className="flex items-center gap-1.5 rounded-full bg-v3-sapphire px-4 py-2 text-[13px] font-semibold text-v3-lime shadow-md">
          🔒 สมาชิกเท่านั้น · แตะเพื่อปลดล็อก
        </span>
      </button>
      {open && <DestinyUpsellModal onClose={() => setOpen(false)} />}
    </div>
  )
}
