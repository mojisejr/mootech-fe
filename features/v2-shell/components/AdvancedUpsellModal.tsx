// features/v2-shell/components/AdvancedUpsellModal.tsx — #359 (ซินแสนุ้ย 2026-09-15)
// popup ชวนอัปเกรด เมื่อผู้ใช้ free กด "เปิดโหมดแอดวานซ์" ทุกจอ (สมพงศ์คู่รัก/งาน/ปฏิทินรายวัน).
// presentational ล้วน: caller คุม open/close + เช็ค tier เอง (เปิด popup เฉพาะ isPaid === false).
// CTA → ร้านค้า (SHOP_HREF); ปุ่มปิดให้ผู้ใช้กลับไปดูผลปกติได้.
import Link from "next/link"
import { SHOP_HREF } from "@/features/v2-shop/upgrade-cta"

export function AdvancedUpsellModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-6" role="dialog" aria-modal="true" aria-label="โหมดแอดวานซ์สำหรับสมาชิก">
      <button type="button" aria-label="ปิด" onClick={onClose} className="absolute inset-0 bg-black/40" />
      <div className="relative w-full max-w-xs rounded-3xl bg-white p-6 text-center shadow-xl" data-testid="advanced-upsell-modal">
        <div className="mx-auto grid size-14 place-items-center rounded-full bg-v3-lime/25 text-3xl">👑</div>
        <p className="mt-3 text-lg font-bold leading-7 text-v3-navy">โหมดแอดวานซ์สำหรับสมาชิก</p>
        <p className="mt-1.5 text-sm leading-5 text-v3-text-muted">อัปเกรดเป็นสมาชิกเพื่อปลดล็อกการวิเคราะห์เชิงลึกทุกด้าน</p>
        <div className="mt-5 flex gap-3">
          <button type="button" onClick={onClose} className="flex-1 rounded-full border border-v3-sapphire px-4 py-2.5 text-sm font-semibold text-v3-sapphire">
            ไว้ก่อน
          </button>
          <Link href={SHOP_HREF} data-testid="advanced-upsell-cta" className="flex-1 rounded-full bg-v3-sapphire px-4 py-2.5 text-sm font-semibold text-v3-lime">
            ดูแพ็กเกจ
          </Link>
        </div>
      </div>
    </div>
  )
}
