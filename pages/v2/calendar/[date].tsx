// MuMate v2 — ปฏิทิน · รายละเอียดวัน (screens 2/3/5). Behind the v2 gate.
//
// PHASE 0 (goo · routing + state, NO designed UI, NO network): mounts useDayDetail + useAdvancedMode +
// useReminderDraft (save-flow) + useReminders and wires them in a THIN scaffold, so the state behaviour
// the done-conditions ask for is real and testable: advanced toggle works 2-way, the save sheet drives
// the save-flow machine (draft→saved), and the day's menu-state derives from whether a reminder exists.
// Lamun's Phase 3/4/5 replace the scaffold body with the Figma screens; hooks/routing here do not change.
import type { GetServerSideProps } from 'next'
import { useRouter } from 'next/router'
import { v2RedirectIfUnauthed } from '@/lib/v2/gate'
import { AppShell } from '@/features/v2-shell/components/AppShell'
import {
  useDayDetail,
  useAdvancedMode,
  useReminderDraft,
  useReminders,
  menuStateForDay,
  MENU_STATE_LABEL,
  type Reminder,
} from '@/features/v2-calendar'

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  ctx.res.setHeader('Cache-Control', 'no-store, must-revalidate')
  const redirect = v2RedirectIfUnauthed(ctx.req)
  if (redirect) return redirect
  return { props: {} }
}

export default function V2CalendarDayPage() {
  const router = useRouter()
  const date = typeof router.query.date === 'string' ? router.query.date : ''
  const { detail } = useDayDetail(date)
  const { advanced, toggle } = useAdvancedMode()
  const draft = useReminderDraft()
  const reminders = useReminders()

  // The day's menu-state (goo drives): บันทึกแล้ว (3) if this date already has a reminder, else มีปุ่มหลัก (2).
  // While the save sheet is open, the sheet's own FormMode (4, no Mate AI) wins.
  const dayMenuState =
    draft.state === 'editing' || draft.state === 'saving' ? draft.menuState : menuStateForDay(reminders.hasReminderFor(date))

  const onSave = () => {
    // build one Reminder per selected ยาม, then commit the machine + grow the list (de-duped).
    const rows: Reminder[] = draft.draft.selectedYamIds.map((yamId) => {
      const yam = detail.yams.find((y) => y.id === yamId)
      return {
        id: `${date}-${yamId}`,
        date,
        yamId,
        yamLabel: yam?.label ?? yamId,
        window: yam?.window ?? '',
        destinations: draft.draft.destinations,
        group: 'upcoming',
      }
    })
    draft.commit()
    if (rows.length) reminders.add(rows)
  }

  return (
    <AppShell title={`วันที่ ${detail.day}`}>
      <section data-testid="calendar-day" className="rounded-2xl bg-white p-4 shadow-sm">
        <p className="mb-2 text-xs text-neutral-400">Phase 0 scaffold — state จริง, UI มาใน Phase ถัดไป (Lamun).</p>
        <p className="text-xs text-neutral-400">menu-state: {MENU_STATE_LABEL[dayMenuState]}</p>

        <h1 className="mt-1 font-semibold text-v3-sapphire">
          {detail.day} · {detail.ganzhi} · {detail.percent}% · {detail.grade}
        </h1>
        <p className="mt-1 text-sm text-neutral-700">{detail.summary}</p>

        <button type="button" onClick={toggle} className="mt-3 text-xs text-v3-sapphire underline">
          โหมดแอดวานซ์: {advanced ? 'เปิด' : 'ปิด'}
        </button>

        {advanced && (
          <div data-testid="advanced-pillars" className="mt-2 flex gap-4 text-xs">
            {detail.pillars?.map((p) => (
              <div key={p.kind}>
                <div className="font-semibold">{p.label}</div>
                <div>{p.cells.join(' / ')}</div>
              </div>
            ))}
          </div>
        )}

        {/* ── save sheet (screen 5) — minimal scaffold of the draft machine ── */}
        <div className="mt-4 border-t pt-3">
          {draft.state === 'idle' && (
            <button
              type="button"
              onClick={() => draft.open(date)}
              className="text-sm text-v3-sapphire underline"
            >
              เพิ่มลงปฏิทิน เพื่อแจ้งเตือน
            </button>
          )}

          {(draft.state === 'editing' || draft.state === 'saving') && (
            <div data-testid="save-sheet">
              <p className="text-xs font-semibold">เลือกยาม</p>
              {detail.yams.map((y) => (
                <label key={y.id} className="block text-xs">
                  <input
                    type="checkbox"
                    checked={draft.draft.selectedYamIds.includes(y.id)}
                    onChange={() => draft.toggleYam(y.id)}
                  />{' '}
                  {y.label} · {y.window}
                </label>
              ))}
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  disabled={!draft.canCommit}
                  onClick={onSave}
                  className="text-sm text-v3-sapphire underline disabled:text-neutral-300"
                >
                  บันทึก
                </button>
                <button type="button" onClick={draft.cancel} className="text-sm text-neutral-500 underline">
                  ยกเลิก
                </button>
              </div>
            </div>
          )}

          {draft.state === 'saved' && (
            <div data-testid="saved">
              <p className="text-sm text-green-700">✓ คุณบันทึกลงปฏิทินแล้ว</p>
              <button type="button" onClick={draft.dismiss} className="text-xs text-neutral-500 underline">
                ปิด
              </button>
            </div>
          )}
        </div>
      </section>
    </AppShell>
  )
}
