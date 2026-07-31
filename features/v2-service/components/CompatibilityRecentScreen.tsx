// features/v2-service/components/CompatibilityRecentScreen.tsx — ดวงสมพงศ์ ก้อน 2G "ดูดวงสมพงศ์ล่าสุด".
// The history list that catches the user who backed out of a calc (quota spent, no result) — reachable from
// the picker (D38) and each row re-opens the ALREADY-computed result (D41, navigate only — no re-calc, no
// second quota hit, unlike v1's onSelectLog which re-calculates).
//
// Rule 4 (ไม่มีข้อมูล = ไม่แสดง): a missing friend name → "คุณ" alone (NEVER v1's fabricated "คุณ & เพื่อน");
//   a missing avatar → an initial-letter placeholder (derived from the name, not a fake photo); a matching_type
//   v2 doesn't support (legacy BOSS/EMPLOYEE — D43) → the chip is HIDDEN, the card still renders + navigates,
//   the screen never crashes.
// State-table: loading → skeleton (never a forever spinner) · error → honest fallback · empty → "ยังไม่มีประวัติ".
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { Menubar } from '@/features/v2-shell/components/Menubar'
import { useCompatibilityRecent } from '../hooks/useCompatibilityRecent'
import { matchTypeLabel, recentCardTitle, type RecentMatchItem } from '../compatibility-recent'

function BackChevron() {
  return (
    <svg viewBox="0 0 20 20" className="size-6" fill="none" aria-hidden>
      <path d="M12.5 5 7.5 10l5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// One 40px avatar — the picture when present, else an initial-letter placeholder (NOT a fake photo, rule 4).
function Avatar({ src, seed, className }: { src?: string | null; seed?: string | null; className?: string }) {
  const initial = (seed ?? '').trim().charAt(0)
  return (
    <span className={`relative grid size-10 shrink-0 place-items-center overflow-hidden rounded-full bg-v3-sapphire text-sm font-bold text-white ${className ?? ''}`}>
      {src ? <Image src={src} alt="" fill sizes="40px" style={{ objectFit: 'cover' }} /> : <span>{initial || '?'}</span>}
    </span>
  )
}

function RecentCard({ item, onOpen }: { item: RecentMatchItem; onOpen: (id: string) => void }) {
  const friendName = item.friend?.name ?? ''
  const typeLabel = matchTypeLabel(item.type) // undefined for legacy/unknown → chip hidden (D43)
  return (
    <button
      type="button"
      data-testid={`compat-recent-card-${item.id}`}
      onClick={() => onOpen(item.id)}
      className="flex w-full items-center gap-4 rounded-[16px] bg-white px-4 py-4 text-left"
    >
      {/* two overlapping avatars — คุณ (user) + เพื่อน (friend) */}
      <span className="flex shrink-0 items-center">
        <Avatar src={item.user?.picture} seed="คุณ" className="ring-2 ring-white" />
        <Avatar src={item.friend?.picture} seed={friendName} className="-ml-3 ring-2 ring-white" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        {typeLabel ? (
          <span data-testid={`compat-recent-card-${item.id}-type`} className="text-[13px] font-medium text-v3-text-body">{typeLabel}</span>
        ) : null}
        <span data-testid={`compat-recent-card-${item.id}-title`} className="truncate text-[17px] font-bold text-v3-navy">{recentCardTitle(friendName)}</span>
      </span>
      <span aria-hidden className="shrink-0 text-v3-sapphire"><svg viewBox="0 0 20 20" className="size-5" fill="none"><path d="M7.5 5l5 5-5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg></span>
    </button>
  )
}

function Shell({ children, state }: { children: React.ReactNode; state: string }) {
  return (
    <div data-testid="compat-recent-screen" data-state={state} className="relative min-h-screen w-full overflow-x-hidden bg-v3-bg-cream font-ibm">
      <div className="relative z-10 mx-auto flex w-full max-w-md flex-col gap-4 px-4 pb-36 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <header className="flex items-center gap-2 py-1">
          <Link href="/v2/service" aria-label="ย้อนกลับ" className="grid size-8 shrink-0 place-items-center rounded-full text-v3-navy"><BackChevron /></Link>
          <h1 className="min-w-0 flex-1 text-[22px] font-bold leading-8 text-v3-navy">ดูดวงสมพงศ์ล่าสุด</h1>
        </header>
        {children}
      </div>
      <Menubar />
    </div>
  )
}

export function CompatibilityRecentScreen() {
  const r = useCompatibilityRecent()
  const router = useRouter()
  // D41: re-open the ALREADY-computed result — navigate only, NO re-calculate (no second quota hit).
  const onOpen = (id: string) => router.push(`/v2/service/compatibility/result/${id}`)

  if (r.loading) {
    return (
      <Shell state="loading">
        {/* skeleton rows — resolves; never an infinite spinner */}
        {[0, 1, 2].map((i) => (
          <div key={i} data-testid="compat-recent-skeleton" className="flex w-full items-center gap-4 rounded-[16px] bg-white px-4 py-4">
            <span className="flex shrink-0 items-center"><span className="size-10 animate-pulse rounded-full bg-v3-ghost-white" /><span className="-ml-3 size-10 animate-pulse rounded-full bg-v3-ghost-white" /></span>
            <span className="flex flex-1 flex-col gap-1.5"><span className="h-3 w-20 animate-pulse rounded bg-v3-ghost-white" /><span className="h-4 w-40 animate-pulse rounded bg-v3-ghost-white" /></span>
          </div>
        ))}
      </Shell>
    )
  }

  if (r.error) {
    return (
      <Shell state="error">
        <div data-testid="compat-recent-error" className="mt-10 flex flex-col items-center gap-4 text-center">
          <p className="text-[16px] font-bold text-v3-navy">โหลดประวัติไม่สำเร็จ</p>
          <p className="text-[14px] leading-6 text-v3-text-body">เกิดข้อผิดพลาดระหว่างดึงประวัติ ลองกลับเข้ามาใหม่อีกครั้ง</p>
          <Link href="/v2/service" className="rounded-[100px] bg-v3-sapphire px-6 py-3 text-[14px] font-semibold text-white">กลับไปหน้าบริการ</Link>
        </div>
      </Shell>
    )
  }

  if (r.items.length === 0) {
    return (
      <Shell state="empty">
        <div data-testid="compat-recent-empty" className="mt-10 flex flex-col items-center gap-3 text-center">
          <p className="text-[16px] font-bold text-v3-navy">ยังไม่มีประวัติ</p>
          <p className="text-[14px] leading-6 text-v3-text-body">เมื่อคุณดูดวงสมพงศ์แล้ว รายการจะมาอยู่ที่นี่ให้กลับมาดูได้</p>
        </div>
      </Shell>
    )
  }

  return (
    <Shell state="ready">
      <ul className="flex flex-col gap-3">
        {r.items.map((item) => (
          <li key={item.id}><RecentCard item={item} onOpen={onOpen} /></li>
        ))}
      </ul>
    </Shell>
  )
}

export default CompatibilityRecentScreen
