// MuMate v2 — ปฏิทิน · การแจ้งเตือนทั้งหมด (screen 6, §list แบบ ข). Behind the v2 gate.
//
// PHASE 0 (goo · routing + state, NO designed UI, NO network): mounts useReminders and renders the
// 2-group superset (กำลังจะถึง / เตือนไปแล้ว) as a THIN scaffold. Because it is a real list (not a static
// 1-row picture), 5 ยาม show 5 rows. Lamun's Phase 6 replaces the scaffold with the Figma list UI; the
// grouped list shape here does not change.
import type { GetServerSideProps } from 'next'
import { v2RedirectIfUnauthed } from '@/lib/v2/gate'
import { AppShell } from '@/features/v2-shell/components/AppShell'
import { useReminders, type Reminder } from '@/features/v2-calendar'

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  ctx.res.setHeader('Cache-Control', 'no-store, must-revalidate')
  const redirect = v2RedirectIfUnauthed(ctx.req)
  if (redirect) return redirect
  return { props: {} }
}

function Row({ r, onCancel }: { r: Reminder; onCancel: (id: string) => void }) {
  return (
    <li className="border-b py-1 text-xs">
      <div>🔔 {r.yamLabel}</div>
      <div className="text-neutral-500">
        {r.date} · {r.window} · {r.destinations.join(' / ')}
      </div>
      {r.group === 'upcoming' && (
        <button type="button" onClick={() => onCancel(r.id)} className="text-neutral-400 underline">
          ยกเลิก
        </button>
      )}
    </li>
  )
}

export default function V2CalendarNotificationsPage() {
  const { list, cancel } = useReminders()

  return (
    <AppShell title="การแจ้งเตือน">
      <section data-testid="calendar-notifications" className="rounded-2xl bg-white p-4 shadow-sm">
        <p className="mb-2 text-xs text-neutral-400">Phase 0 scaffold — list state จริง, UI มาใน Phase ถัดไป (Lamun).</p>
        <p className="text-sm font-semibold text-v3-sapphire">
          ตั้งแจ้งเตือนแล้ว · {list.totalYams} ยาม · {list.totalDays} วัน
        </p>

        <h2 className="mt-3 text-xs font-semibold text-neutral-600">กำลังจะถึง</h2>
        <ul>
          {list.upcoming.map((r) => (
            <Row key={r.id} r={r} onCancel={cancel} />
          ))}
        </ul>

        <h2 className="mt-3 text-xs font-semibold text-neutral-600">เตือนไปแล้ว</h2>
        <ul>
          {list.past.map((r) => (
            <Row key={r.id} r={r} onCancel={cancel} />
          ))}
        </ul>
      </section>
    </AppShell>
  )
}
