// features/v2-service/components/AddFriendSheet.tsx — the "add a friend" bottom sheet, Figma 636:18533.
// Collects the birth info the compatibility calc needs and calls goo's createFriend (which wraps v1's
// MemberWithFriendCreateApi). Slice 1: create-only (v1 has no LINE/FB import — those 3 rows are shown
// DISABLED, not hidden). No new API, no calc.
//
// FLAGS → บอง/ฟีม (verbatim + deliberate divergences, like ซินแส #145 — never silent):
//  • GENDER selector (👨/👩) is NOT in the Figma sheet but IS in v1 (modal-add-freind 446–474) — ฟีม's
//    REFRAME 3: gender is a real calc input; V3 dropped it; locking MALE would corrupt every female friend
//    silently. Added per ฟีม's order. Default is the VISIBLE pre-highlighted MALE (user SEES it + can change
//    → the value is never a hidden backend default — บอง's brake on `form.gender || MALE`). The value SENT is
//    always what the user sees/picks.
//  • Figma title reads "เพียงเเค่" (double สระเอ, a typo) → CORRECTED to "เพียงแค่" by ฟีม's ruling (2026-07-29),
//    a deliberate divergence from Figma like ซินแส #145. Figma still shows the typo.
//  • surname is not in the Figma form → sent '' (goo documents in buildCreateFriendArgs).
//  • image upload: the affordance is rendered; wiring the file→URL upload needs v1's upload endpoint — NOT in
//    Slice 1, so imageProfile is sent '' for now (flagged; the row is honest, not a dead-silent control).
import { useState } from 'react'
import type { NewFriendForm, Gender, EditFriendForm } from '../compatibility-api'
import type { CreateFriendResult, UpdateFriendResult } from '../hooks/useCompatibility'

// goo's NewFriendForm (#149) now carries `gender` (required union, no fallback) — the form IS NewFriendForm.
type AddFriendForm = NewFriendForm

const TH_MONTHS = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม']

function Label({ children }: { children: React.ReactNode }) {
  return <span className="text-[14px] font-semibold leading-5 text-v3-text-body">{children}</span>
}
const inputCls = 'h-[52px] w-full rounded-[100px] border border-v3-border-input bg-white px-5 text-[16px] font-normal leading-6 text-v3-text-filled placeholder:text-[#94A3B8] outline-none focus:border-v3-sapphire'

// #266 — EDIT MODE. The sheet keeps one set of fields for both jobs; a separate edit screen would be a
// second copy of the day/month/year + gender + "จำไม่ได้" controls, and copies drift.
//
// `initial.surname` is carried but NOT shown: the form has never collected a surname (create sends ''),
// while a friend linked from v1 may have a real one. Holding it and handing it straight back is what stops
// "edited the birth time" from also erasing the surname — "not edited" and "set to empty" must not be the
// same value. Same reason `friendId` is the caller's business, not this component's.
export type EditFriendMode = {
  initial: EditFriendForm
  onSave: (form: EditFriendForm) => Promise<UpdateFriendResult>
}

// Save-failure copy in the vocabulary #263 set for this whole line: name what happened, then say what to
// do — and never show the raw server message. Wording is specific to SAVING (not calculating), so the two
// screens read as one product without one file quietly owning the other's strings.
const SAVE_ERROR_COPY: Record<'system' | 'network', [string, string]> = {
  network: ['เชื่อมต่อไม่ได้', 'ตรวจสัญญาณอินเทอร์เน็ตแล้วลองอีกครั้ง'],
  system: ['บันทึกไม่สำเร็จ', 'ไม่ใช่ข้อมูลของคุณผิด ลองอีกครั้งได้เลย'],
}

/** 'YYYY-MM-DD' (CE) → the three form fields, with the year in พ.ศ. as the input shows it. */
function splitBirthDay(iso: string): { day: string; month: string; yearBE: string } {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? '')
  if (!m) return { day: '', month: '', yearBE: '' } // unparseable → blanks the user can fill, never a guess
  return { day: String(Number(m[3])), month: String(Number(m[2])), yearBE: String(Number(m[1]) + 543) }
}

export function AddFriendSheet({ onClose, onCreate, edit }: {
  onClose: () => void
  onCreate?: (form: AddFriendForm) => Promise<CreateFriendResult>
  edit?: EditFriendMode
}) {
  const initialDate = splitBirthDay(edit?.initial.birthDay ?? '')
  const [name, setName] = useState(edit?.initial.name ?? '')
  const [day, setDay] = useState(initialDate.day)
  const [month, setMonth] = useState(initialDate.month) // 1-12 as string
  const [yearBE, setYearBE] = useState(initialDate.yearBE) // พ.ศ.
  const [time, setTime] = useState(edit?.initial.time ?? '') // HH:mm
  // "จำไม่ได้" ⇒ is_remember_time = false. In edit mode a friend added WITHOUT a time opens with this
  // ticked; unticking it and typing a time is the "fill it in later" case the ใบ asks for, and what is
  // asserted is the value SENT, not the state of the checkbox.
  const [noTime, setNoTime] = useState(edit ? !edit.initial.isRememberTime : false)
  const [gender, setGender] = useState<Gender>(edit?.initial.gender ?? 'MALE') // VISIBLE default (บอง: seen, not hidden)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(false)
  const [saveReason, setSaveReason] = useState<'system' | 'network' | null>(null)

  // required to enable บันทึก: name + full birthdate. time optional (จำไม่ได้).
  const dobValid = /^\d{1,2}$/.test(day) && !!month && /^\d{4}$/.test(yearBE)
  const canSave = name.trim().length > 0 && dobValid && !saving

  async function submit() {
    if (!canSave) return
    setSaving(true); setError(false)
    const birthDay = `${Number(yearBE) - 543}-${month.padStart(2, '0')}-${day.padStart(2, '0')}` // BE→CE 'YYYY-MM-DD'
    const form: AddFriendForm = {
      name: name.trim(),
      birthDay,
      time: noTime ? '' : time,
      isRememberTime: !noTime,
      imageProfile: '', // upload wiring deferred (see FLAG) — never a fabricated URL
      gender, // the VISIBLE selection (done-cond #13: the value SENT is what the user sees)
    }
    if (edit) {
      // Hand back everything that came in, with only what the form can change replaced. surname rides
      // through untouched — see the note on EditFriendMode.
      const res = await edit.onSave({
        name: form.name,
        surname: edit.initial.surname,
        birthDay: form.birthDay,
        time: form.time,
        isRememberTime: form.isRememberTime,
        gender: form.gender,
      })
      setSaving(false)
      // On success the caller closes the sheet (it also re-reads the friend first). On failure stay open
      // and keep every field the user typed — reopening an empty sheet would be a second loss.
      if (!res.ok) { setError(true); setSaveReason(res.reason === 'network' ? 'network' : 'system') }
      return
    }
    const res = await onCreate!(form)
    setSaving(false)
    if (res.ok) onClose()
    else setError(true)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-[rgba(33,33,33,0.6)]" onClick={onClose}>
      <div className="flex max-h-[90vh] w-full max-w-md flex-col gap-[18px] overflow-y-auto rounded-t-[28px] bg-v3-bg-cream px-5 pb-10 pt-3 font-ibm" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={edit ? 'แก้ไขข้อมูลเพื่อน' : 'เพิ่มเพื่อน'} data-testid="add-friend-sheet">
        <span aria-hidden className="mx-auto h-[5px] w-11 shrink-0 rounded-full bg-v3-border-warm-2" />
        <h2 className="text-center text-[20px] font-bold leading-7 text-v3-navy">
          {edit ? 'แก้ไขข้อมูลเพื่อน' : <>เริ่มต้นดูดวงเพียงแค่ใส่<br />วันเดือน ปี เกิด</>}
        </h2>

        <div className="flex w-full flex-col gap-5">
          <div className="flex flex-col gap-2">
            <Label>ชื่อเพื่อน</Label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="ใส่ชื่อเพื่อน" className={inputCls} data-testid="add-friend-name" />
          </div>

          <div className="flex w-full items-start gap-1">
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <Label>วันเกิด</Label>
              <select value={day} onChange={(e) => setDay(e.target.value)} className={inputCls} data-testid="add-friend-day">
                <option value="" disabled>วว</option>
                {Array.from({ length: 31 }, (_, i) => <option key={i + 1} value={String(i + 1)}>{i + 1}</option>)}
              </select>
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <Label>เดือนเกิด</Label>
              <select value={month} onChange={(e) => setMonth(e.target.value)} className={inputCls} data-testid="add-friend-month">
                <option value="" disabled>ดด</option>
                {TH_MONTHS.map((m, i) => <option key={i + 1} value={String(i + 1)}>{m}</option>)}
              </select>
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <Label>ปีเกิด (พ.ศ.)</Label>
              <input value={yearBE} onChange={(e) => setYearBE(e.target.value.replace(/\D/g, '').slice(0, 4))} inputMode="numeric" placeholder="ปปปป" className={inputCls} data-testid="add-friend-year" />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label>เวลาเกิด</Label>
            <input value={time} onChange={(e) => setTime(e.target.value)} disabled={noTime} placeholder="ชั่วโมง:นาที" className={`${inputCls} disabled:bg-v3-disabled-bg/40`} data-testid="add-friend-time" />
          </div>

          <button type="button" onClick={() => setNoTime((v) => !v)} className="flex items-center gap-2" data-testid="add-friend-notime">
            <span className={`grid size-6 place-items-center rounded-md border ${noTime ? 'border-v3-sapphire bg-v3-sapphire text-white' : 'border-v3-border-checkbox bg-white'}`}>
              {noTime && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5L20 6" /></svg>}
            </span>
            <span className="text-[16px] font-normal leading-6 text-[#444]">จำไม่ได้</span>
          </button>

          {/* GENDER — REFRAME 3 (ฟีม): not in Figma, restored from v1. Pre-highlighted VISIBLE MALE. */}
          <div className="flex flex-col gap-2">
            {/* #266 changed this for EDIT only and left create saying "ของคุณ", with a note that it was
                "reported rather than quietly rewritten here". #277 is that report coming back.
                🔴 WHY IT IS NOT A TYPO. This sheet collects a birth date and time that get fed to a
                compatibility calculation. A label reading "ของคุณ" on a form about somebody else invites the
                user to enter THEIR OWN details — and the result of that mistake is a reading of the user
                against themselves, which looks completely normal and is wrong. Nothing downstream can catch
                it: the data is well-formed, it is simply about the wrong person.
                Both modes now say the same thing, so the conditional is gone: this sheet is ALWAYS about a
                friend, and there is no longer a branch where it can claim otherwise. */}
            <Label>เพศดั้งเดิมของเพื่อน</Label>
            <div className="grid grid-cols-2 gap-[18px]">
              {(['MALE', 'FEMALE'] as const).map((g) => (
                <button
                  key={g} type="button" onClick={() => setGender(g)} data-testid={`add-friend-gender-${g}`} aria-pressed={gender === g}
                  className={`flex items-center justify-center rounded-2xl p-4 text-[16px] font-medium text-v3-navy ${gender === g ? 'border-2 border-v3-sapphire bg-v3-endeavour-100' : 'border border-v3-border-dropdown bg-white'}`}
                >
                  {g === 'MALE' ? '👨 ผู้ชาย' : '👩 ผู้หญิง'}
                </button>
              ))}
            </div>
          </div>

          <div className="flex w-full flex-col gap-3 rounded-2xl border border-v3-border-card bg-white/65 p-6 backdrop-blur">
            <div className="flex items-center gap-2">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#464646" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><rect x="4" y="10" width="16" height="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg>
              <span className="flex-1 text-[15px] font-bold leading-normal text-v3-text-body">ปลอดภัย 100%</span>
            </div>
            <p className="text-[14px] font-normal leading-[22px] text-v3-text-detail">ข้อมูลที่คุณให้มา เราใช้แค่คำนวณดวงเท่านั้น ไม่เปิดเผย ไม่แชร์ เก็บไว้อย่างปลอดภัย</p>
          </div>

          {/* upload affordance — file→URL wiring deferred (FLAG); honest, not a dead control */}
          <button type="button" onClick={() => setError(false)} className="flex w-full items-center gap-3 overflow-hidden rounded-3xl bg-v3-ghost-white py-3 pl-3 pr-4 text-left" data-testid="add-friend-upload" aria-disabled title="อัพโหลดรูป (เร็วๆ นี้)">
            <span className="grid size-10 shrink-0 place-items-center rounded-full border border-dashed border-v3-sapphire bg-white text-v3-sapphire">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 15V4M8 8l4-4 4 4" /><path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" /></svg>
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="text-[16px] font-bold uppercase leading-6 text-v3-sapphire">อัพโหลดรูป</span>
              <span className="truncate text-[14px] font-normal leading-[22px] text-v3-text-detail">Drag &amp; drop or click to upload</span>
            </span>
          </button>

          {/* #266 — in edit mode the failure says WHICH failure (goo's seam carries the reason), in the
              same shape #263 gave the calculation: bold what happened, then what to do. Create keeps its
              existing single line: its seam does not carry a reason yet, and inventing one here would be
              the screen claiming to know something it does not. */}
          {error && (
            <p role="alert" data-testid="add-friend-error" className="text-center text-[14px] font-medium text-v3-error">
              {edit && saveReason ? (
                <>
                  <span className="block font-bold">{SAVE_ERROR_COPY[saveReason][0]}</span>
                  <span className="block font-normal">{SAVE_ERROR_COPY[saveReason][1]}</span>
                </>
              ) : 'บันทึกไม่สำเร็จ ลองอีกครั้ง'}
            </p>
          )}

          <button type="button" onClick={submit} disabled={!canSave} aria-disabled={!canSave} data-testid="add-friend-save"
            className={`w-full rounded-[100px] py-3.5 text-center text-[16px] font-bold uppercase text-white ${canSave ? 'bg-v3-sapphire' : 'cursor-not-allowed bg-v3-disabled-bg'}`}>
            {saving ? 'กำลังบันทึก…' : edit ? 'บันทึกการแก้ไข' : 'บันทึก'}
          </button>
        </div>

        {/* create-only: connecting an account is a way to ADD friends, meaningless while editing one */}
        {!edit && <p className="text-center text-[16px] font-normal leading-6 text-[#9EA8B8]">หรือเชื่อมต่อบัญชี</p>}

        {/* 3 account-connect options — DISABLED (not hidden): no backend (done-cond #12). */}
        <div className={`w-full flex-col gap-2 ${edit ? 'hidden' : 'flex'}`}>
          {[
            { label: 'Facebook Friends', bg: 'bg-[#1A78F2]', id: 'facebook' },
            { label: 'Invite Friends', bg: 'bg-v3-cyan', id: 'invite' },
            { label: 'Find Contacts', bg: 'bg-[#8C6BD9]', id: 'contacts' },
          ].map((o) => (
            <div key={o.id} data-testid={`connect-${o.id}`} aria-disabled title="ยังไม่เปิดให้ใช้งาน"
              className="flex h-16 w-full cursor-not-allowed items-center gap-3.5 overflow-hidden rounded-3xl bg-white px-3.5 opacity-50">
              <span className={`grid size-9 shrink-0 place-items-center rounded-[10px] ${o.bg} text-white`} aria-hidden>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden><circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 4-6 8-6s8 2 8 6" /></svg>
              </span>
              <span className="flex-1 text-[14px] font-normal leading-[22px] text-v3-text-body">{o.label}</span>
              <span className="text-[12px] font-medium text-v3-text-muted">ยังไม่เปิด</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
