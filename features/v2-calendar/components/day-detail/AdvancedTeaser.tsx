// features/v2-calendar/components/day-detail/AdvancedTeaser.tsx — ผู้ใช้ฟรี: โชว์ส่วน "โหมดแอดวานซ์" แบบเบลอ (Kittipon 2026-10-20)
// แทนสวิตช์เปิดโหมดแอดวานซ์ — ให้เห็นว่ามีอะไรรออยู่ กดตรงไหนก็ขึ้นป็อปอัปชวนสมัคร (AdvancedUpsellModal → หน้าแพ็กเกจ)
// 🔒 เนื้อหาเป็น "ตัวอย่าง" ทั้งหมด ไม่ใช่ข้อมูลจริงของผู้ใช้ — BFF ตัดฟิลด์แอดวานซ์ของฟรีทิ้งตั้งแต่ server อยู่แล้ว
//    (pickFreeDayDetail) เบลอข้อมูลจริงไม่ได้เพราะไม่มีให้เบลอ และไม่ควรมี (เบลอ = แกะดูใน DOM ได้)
const SAMPLE_AREAS: { label: string; pct: number; color: string }[] = [
  { label: "🌏 ไปหาลูกค้า / งานสังคม / สื่อ / ต่างถิ่น", pct: 62, color: "#F08C2E" },
  { label: "🏢 ไปที่ทำงาน / สถานศึกษา / พ่อแม่", pct: 48, color: "#C0392B" },
  { label: "🤝 อยู่กับเพื่อน / พี่น้อง / คู่ครอง", pct: 71, color: "#3E7E3A" },
  { label: "🏠 อยู่บ้าน / ครอบครัว / ลูกน้อง", pct: 55, color: "#F08C2E" },
]

export function AdvancedTeaser({ onTap }: { onTap: () => void }) {
  return (
    <button
      type="button"
      onClick={onTap}
      data-testid="advanced-teaser"
      aria-label="โหมดแอดวานซ์สำหรับสมาชิก — แตะเพื่อดูแพ็กเกจ"
      className="relative w-full overflow-hidden rounded-[20px] bg-white text-left shadow-[0_4px_14px_rgba(26,38,77,0.06)]"
    >
      <div aria-hidden className="pointer-events-none flex select-none flex-col gap-4 p-5 blur-[5px]">
        <p className="text-[18px] font-bold text-v3-navy">ความเข้ากัน 4 ด้าน</p>
        {SAMPLE_AREAS.map((a) => (
          <div key={a.label} className="flex flex-col gap-1.5">
            <span className="text-[14px] font-semibold text-v3-navy">{a.label}</span>
            <span className="flex items-center gap-2">
              <span className="h-2 flex-1 overflow-hidden rounded-full bg-[#EEF0F5]">
                <span className="block h-full rounded-full" style={{ width: `${a.pct}%`, backgroundColor: a.color }} />
              </span>
              <span className="text-[13px] font-bold text-v3-navy">{a.pct}%</span>
            </span>
          </div>
        ))}
        <p className="mt-2 text-[18px] font-bold text-v3-navy">ดิถีวันนี้ · ผู้อุปถัมภ์ · 8 ประตู</p>
        <div className="grid grid-cols-3 gap-2">
          {["มั่นคง", "ปีวอก", "ประตูเปิด", "ทิศตะวันออก", "เทพมงคล", "ยามดี"].map((t) => (
            <span key={t} className="rounded-xl bg-[#EAF3FF] px-2 py-3 text-center text-[13px] font-bold text-v3-sapphire">{t}</span>
          ))}
        </div>
      </div>
      <span className="absolute inset-0 grid place-items-center bg-white/30">
        <span className="flex flex-col items-center gap-2 rounded-2xl bg-white/95 px-5 py-4 text-center shadow-lg">
          <span aria-hidden className="text-2xl">🔒</span>
          <span className="text-[15px] font-black text-v3-navy">ปลดล็อกโหมดแอดวานซ์</span>
          <span className="text-[12px] leading-4 text-v3-text-body">ความเข้ากัน 4 ด้าน · ดิถี · ผู้อุปถัมภ์ · 8 ประตู · ดวงปี/เดือน</span>
          <span className="mt-1 rounded-full bg-v3-sapphire px-4 py-2 text-[13px] font-bold text-v3-lime">ดูแพ็กเกจสมาชิก</span>
        </span>
      </span>
    </button>
  )
}
