// features/v2-share/components/PublicShareToggle.tsx — checkbox "ยินยอมเปิดเผยผล" ใช้ร่วมทุกหน้าที่แชร์ได้ (0033).
// ติ๊ก → แชร์แบบให้เพื่อนกดอ่านผลเต็มได้ (ส่ง isPublic + fullText เข้า snapshot); ไม่ติ๊ก = แชร์แบบเดิม.
export function PublicShareToggle({ checked, onChange, testId }: { checked: boolean; onChange: (v: boolean) => void; testId?: string }) {
  // เอ็ม 2026-09-23: ตัวหนังสือมองไม่เห็น (bg จางมาก + ทับแท็บด้านหลัง) → ใส่กรอบทึบ (พื้นขาว + เส้นขอบ + เงา)
  //   ให้อ่านชัดและบังเนื้อหาที่อยู่หลังแถบลอย. ติ๊กแล้วเปลี่ยนเป็นโทน sapphire ให้รู้ว่าเปิดอยู่.
  return (
    <label
      className={`flex w-full max-w-md items-start gap-2 rounded-2xl border px-4 py-3 text-[12.5px] font-semibold leading-5 shadow-[0_4px_12px_rgba(20,85,164,0.14)] transition-colors ${checked ? "border-v3-sapphire bg-v3-sapphire/10 text-v3-navy" : "border-v3-border-card bg-white text-v3-navy"}`}
    >
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} data-testid={testId} className="mt-0.5 size-[18px] shrink-0 accent-v3-sapphire" />
      เปิดเผยให้เพื่อนกดอ่านผลเต็มได้ (ยินยอมเปิดเผยผลนี้)
    </label>
  )
}
