// features/v2-share/components/ShareConsentNotice.tsx — ข้อความ PDPA แทน checkbox ยินยอม (เอ็ม 2026-09-26).
// เดิม (0033) เป็น checkbox ให้ผู้ใช้ติ๊กก่อนแชร์แบบเปิดเผย. ผู้ใช้เคาะ: เอา checkbox ออก — แชร์ = เปิดเผยผลเสมอ,
//   แล้วแจ้ง "การกดแชร์ถือว่ายินยอมเปิดเผยผล" เป็นความยินยอมโดยชัดแจ้งตาม PDPA (พ.ร.บ.คุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562).
// สไตล์: กรอบทึบ (พื้นขาว + เส้นขอบ + เงา) ให้อ่านชัดและบังเนื้อหาที่อยู่หลังแถบลอย (เหมือน PublicShareToggle เดิม).
export function ShareConsentNotice({ testId }: { testId?: string }) {
  return (
    <p
      data-testid={testId}
      className="flex w-full max-w-md items-start gap-2 rounded-2xl border border-v3-border-card bg-white px-4 py-3 text-[12px] font-medium leading-[1.55] text-v3-navy/80 shadow-[0_4px_12px_rgba(20,85,164,0.14)]"
    >
      <span aria-hidden className="mt-px shrink-0 text-v3-sapphire">ℹ</span>
      <span>
        การกด &ldquo;แชร์&rdquo; ถือว่าคุณให้ความยินยอมโดยชัดแจ้งให้เปิดเผยผลคำทำนายและข้อมูลที่เกี่ยวข้องแก่ผู้ที่ได้รับลิงก์
        ตามพระราชบัญญัติคุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562 (PDPA)
      </span>
    </p>
  )
}

export default ShareConsentNotice
