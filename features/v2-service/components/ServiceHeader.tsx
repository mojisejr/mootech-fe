// features/v2-service/components/ServiceHeader.tsx — the service-hub top chrome, Figma node 626:4403.
// Row: H1 "บริการทั้งหมด" (navy bold 24/32) · "อัพเกรด" pill (grade-yellow, cyan label) · bell · avatar.
//
// SELF-CONTAINED on purpose: home's bell/avatar are private locals inside V2HomeScreen. Extracting a
// shared header would risk shifting home's render — so per บอง's "ยืม ไม่ใช่ย้าย", this page borrows the
// PATTERN, not the code. Home is untouched (its anchor stays green for free).
//
// SCOPE NOTE → บอง/ฟีม: the pill/bell/avatar are DECORATIVE chrome this PR (this page has no auth/state).
// Whether the bell should link to the existing /v2/calendar/notifications screen is a product call — I'm
// surfacing it, not silently wiring nav (reachability discipline: enumerate the entry-point, let ฟีม pick).

function BellIcon() {
  return (
    <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  )
}

export function ServiceHeader() {
  return (
    <header data-testid="service-header" className="flex items-center gap-2 py-4 font-ibm">
      <h1 className="min-w-0 flex-1 text-[24px] font-bold leading-8 text-v3-navy">บริการทั้งหมด</h1>
      {/* decorative chrome — see SCOPE NOTE above */}
      <span className="shrink-0 rounded-lg bg-v3-grade-yellow px-3 py-1.5 text-[16px] font-medium leading-6 text-v3-cyan shadow-sm">
        อัพเกรด
      </span>
      <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-full bg-v3-cyan text-white">
        <BellIcon />
      </span>
      <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-full bg-v3-sapphire text-[16px] font-bold text-white">
        F
      </span>
    </header>
  )
}
