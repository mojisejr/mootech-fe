// สปินเนอร์หมุน (loading) — ใช้ร่วมกันทั้ง /account และหน้าหลัก (/v2)
// ผู้ใช้ 2026-09-12: อยากให้ตอนโหลด "เป็นหมุน ๆ" แทน skeleton บล็อกเทา. ถอดออกจาก AccountScreen (เดิม inline)
// มาเป็น component กลางเพื่อให้หน้าอื่นใช้ท่าเดียวกันได้.
export function Spinner({ className = 'size-6 text-v3-sapphire' }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity="0.2" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

export default Spinner
