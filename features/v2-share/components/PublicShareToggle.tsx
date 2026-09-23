// features/v2-share/components/PublicShareToggle.tsx — checkbox "ยินยอมเปิดเผยผล" ใช้ร่วมทุกหน้าที่แชร์ได้ (0033).
// ติ๊ก → แชร์แบบให้เพื่อนกดอ่านผลเต็มได้ (ส่ง isPublic + fullText เข้า snapshot); ไม่ติ๊ก = แชร์แบบเดิม.
export function PublicShareToggle({ checked, onChange, testId }: { checked: boolean; onChange: (v: boolean) => void; testId?: string }) {
  return (
    <label className="flex w-full max-w-md items-start gap-2 rounded-2xl bg-v3-sapphire/5 px-4 py-2.5 text-[12px] font-medium leading-4 text-v3-text-body">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} data-testid={testId} className="mt-0.5 size-4 shrink-0 accent-v3-sapphire" />
      เปิดเผยให้เพื่อนกดอ่านผลเต็มได้ (ยินยอมเปิดเผยผลนี้)
    </label>
  )
}
