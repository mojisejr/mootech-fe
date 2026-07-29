// features/v2-service/components/ComingSoonSheet.tsx — a small honest "ยังไม่เปิด" bottom sheet for the
// Slice-1 placeholders (result flow, "ดูดวงสมพงศ์ล่าสุด", self-edit). done-cond #8: never a dead-silent tap —
// name what the user reached and say plainly it isn't open yet (no fake progress, no fake-broken look).
export function ComingSoonSheet({ label, onClose }: { label: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30" onClick={onClose}>
      <div className="w-full max-w-md rounded-t-[28px] bg-white p-6 pb-10 font-ibm" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={label}>
        <div className="mb-2 flex items-center justify-between">
          <span className="rounded-full bg-v3-grade-yellow px-3 py-1 text-[13px] font-semibold leading-5 text-v3-navy">เร็วๆ นี้</span>
          <button type="button" aria-label="ปิด" onClick={onClose} className="grid size-8 place-items-center rounded-full text-v3-text-muted hover:bg-v3-ghost-white">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="m6 6 12 12M18 6 6 18" /></svg>
          </button>
        </div>
        <div className="flex flex-col items-center gap-2 py-6 text-center">
          <h2 data-testid="coming-soon-label" className="text-[18px] font-bold leading-7 text-v3-navy [word-break:break-word]">{label}</h2>
          <p className="max-w-xs text-[14px] font-medium leading-6 text-v3-text-body">ส่วนนี้ยังไม่เปิดให้ใช้งาน เรากำลังตั้งใจทำอยู่ และจะเปิดให้ใช้เมื่อพร้อมจริงๆ</p>
        </div>
      </div>
    </div>
  )
}
