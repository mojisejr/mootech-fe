// features/v2-account/components/ProfileGate.tsx — การ์ด 3 สถานะกลางของหน้าย่อยบัญชี
// (loading / ไม่ล็อกอิน / โหลดล้ม) — ห้ามสถานะล้มไปเป็น "ข้อมูลว่าง" (บทเรียน #365)
import Link from "next/link"

export function ProfileGate({
  loading,
  kind,
  title = "โหลดข้อมูลไม่สำเร็จ",
  onRetry,
}: {
  loading: boolean
  kind: "ok" | "not_authenticated" | "failed"
  title?: string
  onRetry?: () => void
}) {
  if (loading) {
    return (
      <div className="mt-3 flex flex-col gap-2" data-testid="profile-gate-loading">
        <div className="h-[96px] w-full animate-pulse rounded-[24px] bg-v3-ghost-white" />
      </div>
    )
  }
  if (kind === "not_authenticated") {
    return (
      <div className="mt-4 rounded-[24px] bg-white p-5 text-center shadow-[0_4px_15px_rgba(26,38,77,0.12)]" data-testid="profile-gate-auth">
        <p className="text-sm font-bold text-v3-navy">ไม่พบข้อมูลผู้ใช้</p>
        <Link href="/v2/login" className="mt-3 grid h-11 place-items-center rounded-full bg-v3-cyan text-sm font-bold text-white">
          เข้าสู่ระบบ
        </Link>
      </div>
    )
  }
  if (kind === "failed") {
    return (
      <div className="mt-4 rounded-[24px] bg-white p-5 text-center shadow-[0_4px_15px_rgba(26,38,77,0.12)]" data-testid="profile-gate-error">
        <span aria-hidden className="mx-auto mb-2 grid size-11 place-items-center rounded-full bg-[#FDECEC] text-[#A83238]">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 9v4M12 17h.01" /><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" /></svg>
        </span>
        <p className="text-sm font-bold text-v3-navy">{title}</p>
        <p className="mt-1 text-[12px] leading-4 text-v3-text-muted">ลองใหม่อีกครั้ง หรือแจ้งทีมงานถ้ายังไม่หาย</p>
        {onRetry && (
          <button onClick={onRetry} className="mt-3 grid h-11 w-full place-items-center rounded-full bg-v3-cyan text-sm font-bold text-white">
            ลองใหม่
          </button>
        )}
        <a href="https://lin.ee/mumate" target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-[12px] font-bold text-v3-sapphire">
          แจ้งปัญหาทาง LINE @mumate.co
        </a>
      </div>
    )
  }
  return null
}
