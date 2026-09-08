// Screen 5 — the save sheet (Figma 375:13316). A MASK over goo's save-flow machine: every field binds to
// useReminderDraft (draft.selectedYamIds / destinations / note) — NO local useState, NO hand-written guard
// (the save button uses goo's `canCommit`). The sheet is shown only while state ∈ {editing, saving}; on
// `saved` it closes and the bottom menu (state 3) is the "บันทึกแล้ว" indicator (375:16355). Cancel = backdrop
// or handle → draft.cancel (→ idle, draft discarded, menu stays 2). 0 network.
//
// #286 → #298 reframe: the "ปลายทาง" block (the mumate on/off toggle + hidden Google/Apple rows) was a dead
// end — only one destination has a backend, so the switch offered a "choice" of one and, unticked, sent every
// save to a 400 (reminder-plan.ts:43). It was removed. Ticking a ยาม is now enough to save; the system fills
// ['mumate'] itself. The device-state truth the toggle used to tell (6 states) moved onto the SAVE button:
// its text asks for permission on `default`, and a line under it explains when the device can't ring.
// SaveSheet stays presentational (no hook calls) so unit tests feed all 6 states without a browser.
//
// #342: the sheet now READS `draft.state` (it never did — the machine had saving/error since #287 and the
// screen showed neither: tap "บันทึก" and nothing on screen changed, a failure just left the sheet sitting
// open). `saving` → the button says so and stops accepting taps; `error` → a line under it says the save
// failed and the button invites a retry (the machine allows error→saving, useReminderDraft.ts:89).
// ⚠️ ONE failure copy, on purpose: the typed reason (SaveOutcome.kind, reminders-api.ts:13-19) is dropped
// at [date].tsx:112 (`ok = outcome.ok`) and nothing stores it, so the sheet CANNOT know which of the 5 it
// was. It says only what it can prove. Splitting the copy per reason needs the kind carried down first
// (#341/#343) — the sheet must never guess a cause it wasn't told.
import type { YamSlot, ReminderDestination } from '../../types'
import type { UseReminderDraft } from '../../hooks/useReminderDraft'
import type { YamReminderStatus } from '../../tier-lock'
import { guideVariantFor, NOTIFY_REASON, type NotifyState } from '../../notify-state'
import { ExternalCalendarSection } from './ExternalCalendarSection'

// #343 — เหตุที่ติ๊กไม่ได้ ต้องเขียนไว้ข้างตัวมันเอง ❌ ไม่ใช่พึ่งสีจางให้ผู้ใช้เดาเอง
// (สีจาง = "ทำไมกดไม่ได้" ไม่มีคำตอบ · และผู้ใช้ที่แยกสีไม่ออกไม่เห็นความต่างเลย)
export const SHEET_YAM_ADDED_NOTE = 'เพิ่มแล้ว'
export const SHEET_YAM_PAST_NOTE = 'เลยเวลา'

const THAI_MONTHS = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม']

// static display of the date (วัน/เดือน/ปี พ.ศ.) — the sheet is for THIS day; changing date is out of scope,
// so these mirror the route date (not draft state — no invented state).
function DateDisplay({ date }: { date: string }) {
  const [y, m, d] = date.split('-').map(Number)
  // Figma 375:13316 date boxes — white · border #E0DEDB · r14 · py9 · shadow 0/3/10 rgba(26,38,77,.06)
  // · caption 11 regular #464646 · value 15 bold navy
  const box = 'flex flex-1 items-center justify-between rounded-[14px] border border-v3-border-warm bg-white px-3 py-[9px] shadow-[0px_3px_10px_0px_rgba(26,38,77,0.06)]'
  const cap = 'text-[11px] leading-4 text-v3-text-body'
  const val = 'text-[15px] font-bold leading-5 text-v3-navy'
  const chev = <span aria-hidden className="text-v3-navy/40">▾</span>
  return (
    <div className="flex gap-2">
      <span className={box}><span><span className={cap}>วัน</span><br /><span className={val}>{d || '—'}</span></span>{chev}</span>
      <span className={box}><span><span className={cap}>เดือน</span><br /><span className={val}>{m ? THAI_MONTHS[m - 1] : '—'}</span></span>{chev}</span>
      <span className={box}><span><span className={cap}>ปี (พ.ศ.)</span><br /><span className={val}>{y ? y + 543 : '—'}</span></span>{chev}</span>
    </div>
  )
}

export function SaveSheet({
  date,
  yams,
  draft,
  onSave,
  notify,
  onShowGuide,
  statusFor,
  external,
  onToggleExternal,
}: {
  date: string
  yams: YamSlot[]
  draft: UseReminderDraft
  onSave: () => void
  /** สถานะแจ้งเตือนของเครื่อง — เพจอ่านจาก usePwaCapability() แล้วส่งลงมา (ชีทไม่เรียก hook เอง) */
  notify: NotifyState
  onShowGuide: (variant: 'install' | 'permission') => void
  /** เพิ่มปฏิทินภายนอก — สถานะ toggle 3 ปลายทาง (เพจถือ truth · ชีทแค่วาด) */
  external: Record<ReminderDestination, boolean>
  onToggleExternal: (d: ReminderDestination) => void
  /** #343 — สถานะของยามนี้ · ยามที่ `past`/`added` ติ๊กไม่ได้ แต่ **ยังเห็นอยู่**
   *  🔴 นี่คือด่านที่ปิดอาการหลักของใบร่ม #340: ก่อนหน้านี้ `yams.map` วาดทุกตัวเป็น checkbox โดยไม่กรอง
   *  แต่ฝั่งเซิร์ฟเวอร์เป็น all-or-nothing (`lib/v2/reminder-plan.ts`) ⇒ ติ๊กยามที่เลยเวลาปนกับยามที่ดี
   *  = **ไม่มีอันไหนถูกบันทึกเลย** และยามที่ผู้ใช้เลือกถูกก็หายไปด้วยโดยไม่มีอะไรบอก
   *  ⇒ กันที่จอ ❌ ไม่แตะ server (all-or-nothing เป็นคำตัดสินของ #287 ที่มีเหตุผลเขียนไว้) */
  statusFor: (yam: YamSlot) => YamReminderStatus
}) {
  const d = draft.draft
  // when the device can't ring, say so under the save button (the 6-state truth that lived on the removed
  // toggle). null for unknown/granted/default ⇒ no line. guide = install/permission sheet where it can help.
  const saveReason = NOTIFY_REASON[notify]
  const saveGuide = guideVariantFor(notify)
  // the two save-flow states the screen has to tell apart. Every other state either isn't mounted
  // (idle/saved — [date].tsx:125 keeps the sheet only for editing/saving/error) or is the normal form.
  const saving = draft.state === 'saving'
  const failed = draft.state === 'error'
  // `saving` keeps the sapphire fill (work in progress) instead of the grey disabled fill (dead button) —
  // so the `disabled:` variants are left OUT of the class list in that branch rather than overridden,
  // which a plain utility could never win against (:disabled has the higher specificity).
  // Figma 375:13316 save — sapphire pill (r100 · py14) with the LIME label (#E1FF00 · 16 bold), the v3
  // accent that is allowed only on a button label (tailwind.config: 'lime').
  const saveTone = saving
    ? 'bg-v3-sapphire/70 text-v3-lime'
    : 'bg-v3-sapphire text-v3-lime disabled:bg-neutral-300 disabled:text-white/80'
  const saveLabel = saving
    ? 'กำลังบันทึก…'
    : failed
      ? 'ลองบันทึกอีกครั้ง'
      : notify === 'default'
        ? 'บันทึกและเปิดแจ้งเตือน'
        : 'บันทึก'
  return (
    // z-50 = the MODAL layer (DateSelector, LogoutModal). This sheet is a modal, so it belongs ABOVE the
    // bottom Menubar, which is the NAV layer (z-40). At z-40 both sat on the same level and DOM order let
    // the <nav> cover the "บันทึก" button → the click never landed (#299). Not a bespoke bump: it moves the
    // sheet into the layer it always belonged in. (harness/archive/save-sheet-hittable.ts hit-tested it —
    // 🗄️ ARCHIVED by #321: nothing runs it automatically any more, and it cannot run from its old path.
    // Kept as the record of WHY this z-index is what it is; ❌ do not read it as a guard that still bites.)
    <div className="fixed inset-0 z-50" data-testid="save-sheet">
      {/* backdrop — click = cancel (→ idle, menu stays 2) */}
      <button type="button" aria-label="ปิด" data-testid="sheet-backdrop" onClick={draft.cancel} className="absolute inset-0 bg-black/40" />
      {/* Figma 375:13316 sheet — #FAF7F4 · r-t28 · px20 · gap18 · handle 44×5 #E5E3E0 · title 20 bold navy */}
      <div className="absolute inset-x-0 bottom-0 mx-auto flex max-h-[88vh] w-full max-w-md flex-col overflow-hidden rounded-t-[28px] bg-v3-bg-cream font-ibm">
        <button type="button" aria-label="ปิด" onClick={draft.cancel} className="mx-auto mt-3 h-[5px] w-11 rounded-full bg-v3-border-warm-2" />
        <p className="pb-2 pt-3 text-[20px] font-bold leading-7 text-v3-navy px-5">บันทึกลงปฏิทิน เพื่อแจ้งเตือน</p>

        <div className="flex flex-col gap-[18px] overflow-y-auto px-5 pb-3">
          <DateDisplay date={date} />

          {/* โน้ต */}
          {/* card: white · r18 · p16 · shadow 0/4/14 rgba(26,38,77,.06) · heading 18 bold navy · input h52 px20 16 */}
          <div className="rounded-[18px] bg-white p-4 shadow-[0px_4px_14px_0px_rgba(26,38,77,0.06)]">
            <p className="mb-2 text-[18px] font-bold leading-6 text-v3-navy">โน้ต</p>
            <input
              type="text"
              value={d.note ?? ''}
              onChange={(e) => draft.setNote(e.target.value)}
              placeholder="ระบุสิ่งที่ต้องการโน้ต"
              className="h-[52px] w-full rounded-full border border-v3-border-input bg-white px-5 text-[16px] text-v3-text-filled placeholder:text-v3-slate-muted focus:outline-none focus:ring-2 focus:ring-v3-sapphire/30"
            />
          </div>

          {/* เลือกยาม */}
          <div className="rounded-[18px] bg-white p-4 shadow-[0px_4px_14px_0px_rgba(26,38,77,0.06)]">
            <p className="mb-4 text-[18px] font-bold leading-6 text-v3-navy">เลือกยามที่จะให้เตือน</p>
            {/* Figma yam rows — #F9F4F0 · r12 · p16 · gap16; selected #ECF0FD + time in cyan */}
            <div className="flex flex-col gap-2">
              {yams.map((yam) => {
                const status = statusFor(yam)
                const added = status === 'added'
                const past = status === 'past'
                const locked = added || past
                // "เพิ่มแล้ว" ติ๊กค้างไว้ให้เห็น (ผู้ใช้เพิ่มไว้จริง — ช่องว่างจะอ่านว่าของหาย)
                // "เลยเวลา" ไม่ติ๊ก และติ๊กไม่ได้
                const checked = added || d.selectedYamIds.includes(yam.id)
                const note = added ? SHEET_YAM_ADDED_NOTE : past ? SHEET_YAM_PAST_NOTE : null
                return (
                  <label
                    key={yam.id}
                    data-testid={`sheet-yam-${yam.id}`}
                    data-yam-status={status}
                    className={`flex items-center gap-4 rounded-[12px] p-4 ${locked ? 'bg-v3-lemon-chiffon/50' : checked ? 'bg-v3-ghost-white cursor-pointer' : 'bg-v3-lemon-chiffon cursor-pointer'}`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={locked}
                      onChange={() => draft.toggleYam(yam.id)}
                      className="peer sr-only"
                    />
                    <span className={`grid size-6 shrink-0 place-items-center rounded-md border-2 ${past ? 'border-v3-border-checkbox bg-v3-disabled-bg' : checked ? 'border-v3-sapphire bg-v3-sapphire text-white' : 'border-neutral-300 bg-white'}`}>
                      {checked && <svg viewBox="0 0 16 16" className="size-4" fill="none"><path d="M3.5 8.5l3 3 6-6.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={`block text-[16px] font-bold leading-6 ${past ? 'text-v3-text-muted' : checked ? 'text-v3-cyan' : 'text-v3-navy'}`}>{yam.window}</span>
                      <span className="block truncate text-[14px] leading-[22px] text-v3-text-body">{yam.label}</span>
                    </span>
                    {note && (
                      <span data-testid={`sheet-yam-note-${yam.id}`} className="shrink-0 text-[12px] font-bold text-v3-text-muted">
                        {note}
                      </span>
                    )}
                  </label>
                )
              })}
            </div>
          </div>

          {/* เพิ่มปฏิทินภายนอก — Mumate (push) · Google · Apple. Google/Apple เป็น client-side ทั้งคู่
              (#298 เอาออกเพราะไม่มี backend — แต่ทั้งคู่ไม่ต้องมี: เปิด template URL / ดาวน์โหลด .ics) */}
          <ExternalCalendarSection value={external} onToggle={onToggleExternal} />
        </div>

        {/* sticky save — disabled via goo's canCommit (≥1 ยาม; no hand-written guard).
            #298 reframe: the destination switch is gone — ticking a ยาม is enough to save, and the system
            fills ['mumate'] itself. The button now carries the whole action:
              • default  → "บันทึกและเปิดแจ้งเตือน" — one tap saves the reminder AND asks for permission
              • else     → "บันทึก"
            When the device can't ring (denied/needs-install/unsupported) a line under the button says so and
            offers the install/permission guide — the 6-state truth that used to live on the removed toggle. */}
        <div className="bg-v3-bg-cream px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3">
          <button
            type="button"
            data-testid="sheet-save"
            data-notify-state={notify}
            data-save-state={draft.state}
            disabled={!draft.canCommit || saving}
            aria-busy={saving}
            onClick={onSave}
            className={`flex h-[52px] w-full items-center justify-center gap-2 rounded-full text-[16px] font-bold ${saveTone}`}
          >
            {saving && <span aria-hidden data-testid="sheet-save-spinner" className="size-5 shrink-0 animate-spin rounded-full border-[3px] border-white/30 border-t-white" />}
            {saveLabel}
          </button>
          {/* The failure line. Colour is NOT the only carrier (the words say it) and the text itself is
              v3-text-body on white = 9.4:1 — v3-error (#E73E3E) at this size would be 3.6:1 on the sheet's
              ghost-white footer, under AA, so the token does the attention job as the rule where the 3:1
              UI-component bar applies. ❌ It does NOT claim "nothing was saved": on a lost response
              (reminders-api.ts:50 catches the network throw) the row may well exist. */}
          {failed && (
            <p role="alert" data-testid="save-error" className="mt-2 rounded-xl border-l-4 border-v3-error bg-white px-3 py-2 text-xs font-bold leading-5 text-v3-text-body">
              บันทึกไม่สำเร็จ · ลองอีกครั้งได้เลย
            </p>
          )}
          {saveReason && (
            <p data-testid="save-notify-reason" className="mt-2 text-center text-xs font-medium leading-5 text-v3-text-muted">
              {saveReason}
              {saveGuide && (
                <button type="button" data-testid="save-notify-guide" onClick={() => onShowGuide(saveGuide)} className="ml-1 font-bold text-v3-cyan underline">
                  ดูวิธี
                </button>
              )}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
