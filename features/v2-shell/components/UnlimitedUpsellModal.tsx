// features/v2-shell/components/UnlimitedUpsellModal.tsx — ป็อปอัปเมื่อสิทธิ์ฟรีวันนี้หมด (ไพ่/เซียมซี/เบอร์มงคล รวม 1 ครั้ง/วัน)
// Kittipon/gafiw 2026-10-20: กดอีกทีให้ป็อปอัปบอกว่าอยากดูแบบ unlimited ให้สมัคร → ปุ่มไปหน้าแพ็กเกจ
// ปุ่มรอง "ใช้ N QI" (เอ็มเลือกเก็บไว้) — โชว์เมื่อ QI พอ; ไม่พอ → ชวนไปเติม QI แทน
import Link from "next/link"
import { SHOP_HREF } from "@/features/v2-shop/upgrade-cta"

export function UnlimitedUpsellModal({
  affordable,
  cost,
  onUseQi,
  onClose,
}: {
  affordable: boolean
  cost: number
  onUseQi?: () => void
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-[90] grid place-items-center p-6" role="dialog" aria-modal="true" aria-label="อยากดูแบบไม่จำกัด">
      <button type="button" aria-label="ปิด" onClick={onClose} className="absolute inset-0 bg-black/40" />
      <div className="relative w-full max-w-xs rounded-3xl bg-white p-6 text-center shadow-xl" data-testid="unlimited-upsell-modal">
        <div className="mx-auto grid size-14 place-items-center rounded-full bg-v3-lime/25 text-3xl">👑</div>
        <p className="mt-3 text-lg font-bold leading-7 text-v3-navy">อยากดูแบบไม่จำกัด?</p>
        <p className="mt-1.5 text-sm leading-5 text-v3-text-muted">
          สิทธิ์ฟรีวันนี้ใช้ครบแล้ว (ไพ่ · เซียมซี · เบอร์มงคล รวมวันละ 1 ครั้ง) — สมัครสมาชิกเพื่อใช้ได้ไม่จำกัด
        </p>
        <Link href={SHOP_HREF} data-testid="unlimited-upsell-cta" className="mt-5 block rounded-full bg-v3-sapphire px-4 py-2.5 text-sm font-semibold text-v3-lime">
          ดูแพ็กเกจ
        </Link>
        {affordable && onUseQi ? (
          <button type="button" onClick={onUseQi} data-testid="unlimited-upsell-qi" className="mt-2 w-full rounded-full border border-v3-sapphire px-4 py-2.5 text-sm font-semibold text-v3-sapphire">
            ใช้ {cost} QI เปิดอีกครั้ง
          </button>
        ) : (
          <Link href="/v2/qi" data-testid="unlimited-upsell-topup" className="mt-2 block rounded-full border border-v3-sapphire px-4 py-2.5 text-sm font-semibold text-v3-sapphire">
            เติม QI ({cost} QI ต่อครั้ง)
          </Link>
        )}
        <button type="button" onClick={onClose} data-testid="unlimited-upsell-close" className="mt-2 w-full px-4 py-1.5 text-[13px] font-semibold text-v3-text-muted">
          ไว้ก่อน
        </button>
      </div>
    </div>
  )
}
