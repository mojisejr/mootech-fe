// Screen 5 — the save sheet (Figma 375:13316). A MASK over goo's save-flow machine: every field binds to
// useReminderDraft (draft.selectedYamIds / destinations / note) — NO local useState, NO hand-written guard
// (the save button uses goo's `canCommit`). The sheet is shown only while state ∈ {editing, saving}; on
// `saved` it closes and the bottom menu (state 3) is the "บันทึกแล้ว" indicator (375:16355). Cancel = backdrop
// or handle → draft.cancel (→ idle, draft discarded, menu stays 2). 0 network.
//
// Phase 2 (#286) — แถว "แจ้งเตือนในแอป Mumate" เลิกโกหกเรื่องสถานะเครื่อง. เดิม toggle นี้ติ๊กได้
// (และ *เปิดค้างเป็นค่าเริ่มต้น*) โดยไม่สนว่าเครื่องนี้ส่ง push ได้จริงไหม ⇒ ผู้ใช้กดบันทึกแล้ว
// เห็นชิป "มู่เมท" ในรายการ ทั้งที่ไม่มีอะไรจะดังเลยตลอดไป.
// แถวนี้จึงกินสถานะจาก `notifyStateFrom(capability)` ที่เพจอ่านมาให้ — SaveSheet ยังเป็น
// presentational เต็มตัว (ไม่เรียก hook เอง) เพื่อให้ unit test ป้อนได้ครบทั้ง 6 สถานะโดยไม่ต้องมีเบราว์เซอร์.
// Google/Apple ไม่ผูกกับสถานะนี้เลย — push พังไม่ควรทำให้ทั้งแผ่นใช้ไม่ได้.
import type { YamSlot, ReminderDestination } from '../../types'
import type { UseReminderDraft } from '../../hooks/useReminderDraft'
import { canToggleMumate, guideVariantFor, NOTIFY_REASON, type NotifyState } from '../../notify-state'

const DEST_META: Array<{ id: ReminderDestination; name: string; sub: string }> = [
  { id: 'mumate', name: 'แจ้งเตือนในแอป Mumate', sub: 'push notification' },
  { id: 'google', name: 'Google ปฏิทิน', sub: 'เพิ่มเป็น event ในวันนั้น' },
  { id: 'apple', name: 'Apple Calendar', sub: 'เพิ่มเป็น event ในวันนั้น' },
]

const THAI_MONTHS = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม']

// static display of the date (วัน/เดือน/ปี พ.ศ.) — the sheet is for THIS day; changing date is out of scope,
// so these mirror the route date (not draft state — no invented state).
function DateDisplay({ date }: { date: string }) {
  const [y, m, d] = date.split('-').map(Number)
  const box = 'flex flex-1 items-center justify-between rounded-2xl border border-black/10 bg-white px-3 py-2'
  const cap = 'text-[10px] font-medium text-v3-text-body/60'
  const chev = <span aria-hidden className="text-v3-navy/40">▾</span>
  return (
    <div className="flex gap-2">
      <span className={box}><span><span className={cap}>วัน</span><br /><span className="text-sm font-bold text-v3-navy">{d || '—'}</span></span>{chev}</span>
      <span className={box}><span><span className={cap}>เดือน</span><br /><span className="text-sm font-bold text-v3-navy">{m ? THAI_MONTHS[m - 1] : '—'}</span></span>{chev}</span>
      <span className={box}><span><span className={cap}>ปี (พ.ศ.)</span><br /><span className="text-sm font-bold text-v3-navy">{y ? y + 543 : '—'}</span></span>{chev}</span>
    </div>
  )
}

function Toggle({ on, off, testId }: { on: boolean; off?: boolean; testId?: string }) {
  // `off` = ติ๊กไม่ได้จริง (ไม่ใช่แค่ปิดอยู่) — ต้องดูต่างจาก "ปิดแต่กดได้" ไม่งั้นผู้ใช้จะกดซ้ำๆ แล้วสงสัยว่าจอค้าง
  const track = on ? 'bg-v3-sapphire' : off ? 'bg-neutral-200' : 'bg-neutral-300'
  return (
    <span data-testid={testId} className={`relative h-6 w-11 shrink-0 rounded-full transition-none ${track}`}>
      <span className={`absolute top-0.5 size-5 rounded-full shadow ${off ? 'bg-neutral-100' : 'bg-white'} ${on ? 'right-0.5' : 'left-0.5'}`} />
    </span>
  )
}

// "ยังไม่รู้" ต้องเป็นโครงว่าง ❌ ห้ามวาดเป็น toggle ปิด — *ปิดคือคำตอบ แต่ยังไม่รู้ไม่ใช่คำตอบ*
// (ผู้ใช้ที่เห็น toggle ปิดจะสรุปว่าเขาปิดไว้เอง แล้วไปหาที่เปิดในแอป ซึ่งไม่มี)
function ToggleSkeleton() {
  return <span data-testid="mumate-skeleton" aria-hidden className="h-6 w-11 shrink-0 animate-pulse rounded-full bg-neutral-200" />
}

export function SaveSheet({
  date,
  yams,
  draft,
  onSave,
  notify,
  onShowGuide,
  onRequestPermission,
}: {
  date: string
  yams: YamSlot[]
  draft: UseReminderDraft
  onSave: () => void
  /** สถานะแจ้งเตือนของเครื่อง — เพจอ่านจาก usePwaCapability() แล้วส่งลงมา (ชีทไม่เรียก hook เอง) */
  notify: NotifyState
  onShowGuide: (variant: 'install' | 'permission') => void
  onRequestPermission: () => void
}) {
  const d = draft.draft
  const noDestination = d.destinations.length === 0
  return (
    <div className="fixed inset-0 z-40" data-testid="save-sheet">
      {/* backdrop — click = cancel (→ idle, menu stays 2) */}
      <button type="button" aria-label="ปิด" data-testid="sheet-backdrop" onClick={draft.cancel} className="absolute inset-0 bg-black/40" />
      <div className="absolute inset-x-0 bottom-0 mx-auto flex max-h-[88vh] w-full max-w-md flex-col overflow-hidden rounded-t-[24px] bg-v3-ghost-white">
        <button type="button" aria-label="ปิด" onClick={draft.cancel} className="mx-auto mt-2 h-1.5 w-10 rounded-full bg-neutral-300" />
        <p className="pb-1 pt-2 text-center text-lg font-extrabold text-v3-navy">บันทึกลงปฏิทิน เพื่อแจ้งเตือน</p>

        <div className="flex flex-col gap-3 overflow-y-auto px-4 pb-3">
          <DateDisplay date={date} />

          {/* โน้ต */}
          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <p className="mb-2 text-sm font-bold text-v3-navy">โน้ต</p>
            <input
              type="text"
              value={d.note ?? ''}
              onChange={(e) => draft.setNote(e.target.value)}
              placeholder="ระบุสิ่งที่ต้องการโน้ต"
              className="w-full rounded-full border border-black/10 px-4 py-2.5 text-sm text-v3-navy placeholder:text-v3-placeholder focus:outline-none focus:ring-2 focus:ring-v3-sapphire/30"
            />
          </div>

          {/* เลือกยาม */}
          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <p className="mb-3 text-sm font-bold text-v3-navy">เลือกยามที่จะให้เตือน</p>
            <div className="flex flex-col gap-2">
              {yams.map((yam) => {
                const checked = d.selectedYamIds.includes(yam.id)
                return (
                  <label key={yam.id} className={`flex cursor-pointer items-center gap-3 rounded-2xl px-3 py-3 ${checked ? 'bg-v3-pastel-blue/40' : 'bg-v3-lemon-chiffon'}`}>
                    <input type="checkbox" checked={checked} onChange={() => draft.toggleYam(yam.id)} className="peer sr-only" />
                    <span className={`grid size-6 shrink-0 place-items-center rounded-md border-2 ${checked ? 'border-v3-sapphire bg-v3-sapphire text-white' : 'border-neutral-300 bg-white'}`}>
                      {checked && <svg viewBox="0 0 16 16" className="size-4" fill="none"><path d="M3.5 8.5l3 3 6-6.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                    </span>
                    <span className="min-w-0">
                      <span className={`block text-sm font-bold ${checked ? 'text-v3-cyan' : 'text-v3-navy'}`}>{yam.window}</span>
                      <span className="block truncate text-xs text-v3-text-body">{yam.label}</span>
                    </span>
                  </label>
                )
              })}
            </div>
          </div>

          {/* ปลายทาง */}
          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <p className="mb-3 text-sm font-bold text-v3-navy">เพิ่มลงปฏิทินของคุณ</p>
            <div className="flex flex-col gap-3">
              {DEST_META.map((dm) => {
                // เฉพาะแถวมู่เมทที่ผูกกับความสามารถของเครื่อง — Google/Apple ติ๊กได้เสมอ
                if (dm.id !== 'mumate') {
                  return (
                    <button key={dm.id} type="button" onClick={() => draft.toggleDest(dm.id)} className="flex items-center gap-3 text-left">
                      <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-v3-pastel-blue/30 text-lg">🔔</span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-bold text-v3-navy">{dm.name}</span>
                        <span className="block text-xs text-v3-text-body">{dm.sub}</span>
                      </span>
                      <Toggle on={d.destinations.includes(dm.id)} />
                    </button>
                  )
                }

                const loading = notify === 'unknown'
                const usable = canToggleMumate(notify)
                const guide = guideVariantFor(notify)
                const reason = NOTIFY_REASON[notify]
                return (
                  <div key={dm.id} className="flex flex-col gap-1.5">
                    <button
                      type="button"
                      data-testid="dest-mumate"
                      data-notify-state={notify}
                      // ปิดปุ่มจริงด้วย disabled ❌ ไม่ใส่ยามใน handler ให้ดูเหมือนกัน — React กรอง click
                      // บน element ที่ disabled ตั้งแต่ชั้น fiber ⇒ ยามใน handler จะไม่มีวันถูกเรียก และ
                      // เทสต์ที่ "พิสูจน์" ยามนั้นจะเขียวโดยไม่เคยแตะโค้ดจริง
                      disabled={loading || !usable}
                      onClick={() => (notify === 'default' ? onRequestPermission() : draft.toggleDest(dm.id))}
                      className="flex items-center gap-3 text-left disabled:cursor-default"
                    >
                      <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-v3-pastel-blue/30 text-lg">🔔</span>
                      <span className="min-w-0 flex-1">
                        <span className={`block text-sm font-bold ${usable || loading ? 'text-v3-navy' : 'text-v3-text-muted'}`}>{dm.name}</span>
                        <span className="block text-xs text-v3-text-body">{dm.sub}</span>
                      </span>
                      {/* `mumate-toggle` มีอยู่เฉพาะตอน "รู้แล้ว" — การ*ไม่มี*ของมันคือ negative control ที่
                          อ่านได้จากเบราว์เซอร์จริง (ก่อนหน้านี้พิสูจน์ได้แต่ในเทสต์: harness เห็นแค่ปุ่มแถว
                          ซึ่งมีอยู่ทุกสถานะ เลยแยก "โครงว่าง" กับ "toggle ปิด" ไม่ออกจาก DOM) */}
                      {loading ? <ToggleSkeleton /> : <Toggle testId="mumate-toggle" on={d.destinations.includes(dm.id)} off={!usable} />}
                    </button>

                    {reason && (
                      <p data-testid="mumate-reason" className="pl-14 text-xs font-medium leading-5 text-v3-text-muted">
                        {reason}
                        {guide && (
                          <button type="button" data-testid="mumate-guide" onClick={() => onShowGuide(guide)} className="ml-1 font-bold text-v3-cyan underline">
                            ดูวิธี
                          </button>
                        )}
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* sticky save — disabled via goo's canCommit (no hand-written guard) */}
        <div className="border-t border-black/5 bg-v3-ghost-white px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
          {/* ⏳ ช่องที่เปิดขึ้นเพราะใบนี้ถอด default 'mumate' ออก: ติ๊กยามแล้วกดบันทึกได้ทั้งที่ไม่มีปลายทางเลย
              ทางที่ถูกกว่าคือ canCommit บวก destinations.length > 0 แต่ `hasCommittableDraft` เป็นของ goo
              (`save-flow.ts` + ฟันใน calendar-phase0.test.ts) และใบสั่งว่าต้องถามก่อนแตะ — ถามไว้ในใบแล้ว
              ⇒ ระหว่างนี้ "พูดความจริงใต้ปุ่ม" ❌ ไม่บันทึกเงียบ · ถ้า goo รับข้อเสนอ บรรทัดนี้ลบทิ้งได้เลย

              🔴 แก้ถ้อยคำหลัง #287 merge (2026-08-17): ประโยคเดิมเขียนว่า "บันทึกได้ แต่จะไม่มีอะไรเตือน"
              ซึ่งจริงตอนที่ save ยังเป็น client-side. ตอนนี้ `planReminderCommit` ตอบ **400 'ต้องเลือก
              ปลายทางอย่างน้อย 1 อย่าง'** ⇒ มัน **บันทึกไม่ติดเลย** ไม่ใช่บันทึกแล้วเงียบ. ประโยคเดิมจึงกลาย
              เป็นคำโกหกโดยไม่มีเทสต์ไหนแดง — ฟันเดิม assert แค่ว่า testid โผล่ ไม่ได้ assert ประโยค ⇒
              เพิ่ม assert ที่ตัวข้อความใน notify-state-ui.test.tsx ด้วย */}
          {noDestination && draft.canCommit && (
            <p data-testid="save-no-destination" className="mb-2 text-center text-xs font-medium leading-5 text-v3-text-muted">
              ต้องเลือกปลายทางอย่างน้อย 1 อย่าง ถึงจะบันทึกได้
            </p>
          )}
          <button
            type="button"
            data-testid="sheet-save"
            disabled={!draft.canCommit}
            onClick={onSave}
            className="h-[52px] w-full rounded-2xl bg-v3-sapphire text-base font-bold text-white disabled:bg-neutral-300 disabled:text-white/80"
          >
            บันทึก
          </button>
        </div>
      </div>
    </div>
  )
}
