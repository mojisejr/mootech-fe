// MuMate v2 — Phase 0 placeholder body for a tab that has no feature flow yet. Keeps the shell
// navigable (all four tabs reachable, active state visible) while real features are built in Phase B.
type PlaceholderScreenProps = {
  heading: string
  note?: string
}

export function PlaceholderScreen({ heading, note }: PlaceholderScreenProps) {
  return (
    <section className="rounded-2xl bg-white p-6 shadow-sm">
      <h1 className="font-poppins-v3 text-xl font-bold text-v3-sapphire">{heading}</h1>
      <p className="mt-2 text-sm text-neutral-500">
        {note ?? 'โครงหน้านี้พร้อมแล้ว (Phase 0) — ฟีเจอร์จริงจะมาในเฟสถัดไป'}
      </p>
    </section>
  )
}
