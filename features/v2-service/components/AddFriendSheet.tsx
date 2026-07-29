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
import type { NewFriendForm, Gender } from '../compatibility-api'
import type { CreateFriendResult } from '../hooks/useCompatibility'

// goo's NewFriendForm (#149) now carries `gender` (required union, no fallback) — the form IS NewFriendForm.
type AddFriendForm = NewFriendForm

const TH_MONTHS = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม']

function Label({ children }: { children: React.ReactNode }) {
  return <span className="text-[14px] font-semibold leading-5 text-v3-text-body">{children}</span>
}
const inputCls = 'h-[52px] w-full rounded-[100px] border border-v3-border-input bg-white px-5 text-[16px] font-normal leading-6 text-v3-text-filled placeholder:text-[#94A3B8] outline-none focus:border-v3-sapphire'

export function AddFriendSheet({ onClose, onCreate }: {
  onClose: () => void
  onCreate: (form: AddFriendForm) => Promise<CreateFriendResult>
}) {
  const [name, setName] = useState('')
  const [day, setDay] = useState('')
  const [month, setMonth] = useState('') // 1-12 as string
  const [yearBE, setYearBE] = useState('') // พ.ศ.
  const [time, setTime] = useState('') // HH:mm
  const [noTime, setNoTime] = useState(false) // "จำไม่ได้" → is_remember_time = false
  const [gender, setGender] = useState<Gender>('MALE') // VISIBLE default (บอง: seen, not hidden)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(false)

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
    const res = await onCreate(form)
    setSaving(false)
    if (res.ok) onClose()
    else setError(true)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-[rgba(33,33,33,0.6)]" onClick={onClose}>
      <div className="flex max-h-[90vh] w-full max-w-md flex-col gap-[18px] overflow-y-auto rounded-t-[28px] bg-v3-bg-cream px-5 pb-10 pt-3 font-ibm" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="เพิ่มเพื่อน" data-testid="add-friend-sheet">
        <span aria-hidden className="mx-auto h-[5px] w-11 shrink-0 rounded-full bg-v3-border-warm-2" />
        <h2 className="text-center text-[20px] font-bold leading-7 text-v3-navy">เริ่มต้นดูดวงเพียงแค่ใส่<br />วันเดือน ปี เกิด</h2>

        <div className="flex w-full flex-col gap-5">
          <div className="flex flex-col gap-2">
            <Label>ชื่อ</Label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="ใส่ชื่อของคุณ" className={inputCls} data-testid="add-friend-name" />
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
            <Label>เพศดั้งเดิมของคุณ</Label>
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

          {error && <p role="alert" className="text-center text-[14px] font-medium text-v3-error">บันทึกไม่สำเร็จ ลองอีกครั้ง</p>}

          <button type="button" onClick={submit} disabled={!canSave} aria-disabled={!canSave} data-testid="add-friend-save"
            className={`w-full rounded-[100px] py-3.5 text-center text-[16px] font-bold uppercase text-white ${canSave ? 'bg-v3-sapphire' : 'cursor-not-allowed bg-v3-disabled-bg'}`}>
            {saving ? 'กำลังบันทึก…' : 'บันทึก'}
          </button>
        </div>

        <p className="text-center text-[16px] font-normal leading-6 text-[#9EA8B8]">หรือเชื่อมต่อบัญชี</p>

        {/* 3 account-connect options — DISABLED (not hidden): no backend (done-cond #12). */}
        <div className="flex w-full flex-col gap-2">
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
