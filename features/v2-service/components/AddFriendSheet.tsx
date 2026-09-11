// features/v2-service/components/AddFriendSheet.tsx — the "add a friend" bottom sheet, Figma 720:25691 (sheet
// "เลือกเพื่อนร่วมงาน"; earlier draft 636:18533).
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
//  • Title (2026-09-07, frame 720:25691): "เลือกเพื่อนร่วมงาน" 20/28 bold navy, centred. The frame is the
//    colleague screen; the couple screen should pass its own pickLabel via `title` (CompatibilityScreen).
//  • Figma name placeholder reads "ใส่ชื่อของคุณ" — kept as "ใส่ชื่อเพื่อน"/"ชื่อเพื่อน" (#277: the form is about
//    the FRIEND; "ของคุณ" invites the user to enter their own data). Deliberate divergence.
//  • Facebook / Invite / Contacts rows: drawn per Figma (white h64 r24, icon tile, chevron) but there is no
//    backend → each is a ComingSoonAction (ฟีม 2026-08-06 แบบ ก: a control that answers "เร็วๆ นี้"), never faked.
//  • surname is not in the Figma form → sent '' (goo documents in buildCreateFriendArgs).
//  • image upload: the affordance is rendered; wiring the file→URL upload needs v1's upload endpoint — NOT in
//    Slice 1, so imageProfile is sent '' for now (flagged; the row is honest, not a dead-silent control).
import { useEffect, useRef, useState } from 'react'
import type { NewFriendForm, Gender, EditFriendForm } from '../compatibility-api'
import type { CreateFriendResult, UpdateFriendResult } from '../hooks/useCompatibility'
import { ComingSoonAction } from '@/features/v2-shell/components/ComingSoon'
import { toBuddhistYear, toGregorianYear } from '@/lib/v2/thai-date'
// callApiUpload / API โหลดแบบ dynamic ในตอนอัปโหลดเท่านั้น — constants/api/endpoint เรียก next/config getConfig()
// ตั้งแต่ import ทำให้ไฟล์นี้รันใต้ node/vitest ไม่ได้ (เหตุผลเดียวกับที่ compatibility-api เว้น constants/api)

// goo's NewFriendForm (#149) now carries `gender` (required union, no fallback) — the form IS NewFriendForm.
type AddFriendForm = NewFriendForm

const TH_MONTHS = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม']
// ปีเกิด (พ.ศ.) เป็น dropdown: ปีปัจจุบันย้อนหลัง 120 ปี — value/label เป็น พ.ศ. (ตรงกับ state ที่เก็บ พ.ศ.)
const CURRENT_YEAR_BE = toBuddhistYear(new Date().getFullYear())
const YEAR_OPTIONS_BE = Array.from({ length: 121 }, (_, i) => CURRENT_YEAR_BE - i)
// จำนวนวันจริงในเดือน/ปีนั้น ๆ (ค.ศ.) — day 0 ของเดือนถัดไป = วันสุดท้ายของเดือนนี้ (คุม 31 ก.พ., 29 ก.พ. ปีอธิกสุรทิน)
function daysInMonth(monthCE: number, yearCE: number): number {
  if (!monthCE || !yearCE) return 31
  return new Date(yearCE, monthCE, 0).getDate()
}

function Label({ children }: { children: React.ReactNode }) {
  return <span className="text-[14px] font-semibold leading-5 text-v3-text-body">{children}</span>
}
const inputCls = 'h-[52px] w-full rounded-[100px] border border-v3-border-input bg-white px-5 text-[16px] font-normal leading-6 text-v3-text-filled placeholder:text-v3-slate-muted outline-none focus:border-v3-sapphire'
// dropdown fields (วว / ดด / ปปปป in the frame carry a 20px chevron at the right edge): native <select> with
// the arrow drawn by us so the three boxes read the same on iOS and Android.
const selectCls = `${inputCls} appearance-none bg-no-repeat pr-11 [background-position:right_16px_center] [background-size:20px_20px] invalid:text-v3-slate-muted`
const CHEVRON_BG = { backgroundImage: "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='%23464646' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='m6 9 6 6 6-6'/></svg>\")" } as const
// The three "connect an account" rows (frame 720:25759): drawn as in Figma, answered by ComingSoonAction.
const CONNECT_OPTIONS = [
  { label: 'Facebook Friends', bg: 'bg-[#1A78F2]', id: 'facebook' },
  { label: 'Invite Friends', bg: 'bg-v3-cyan', id: 'invite' },
  { label: 'Find Contacts', bg: 'bg-[#8C6BD9]', id: 'contacts' },
] as const

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
  /** ลบเพื่อนคนนี้ (optional) — มีปุ่ม "ลบเพื่อน" ในโหมดแก้ไขเมื่อ caller ส่ง onDelete มา */
  onDelete?: () => Promise<UpdateFriendResult>
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
  return { day: String(Number(m[3])), month: String(Number(m[2])), yearBE: String(toBuddhistYear(Number(m[1]))) }
}

export function AddFriendSheet({ onClose, onCreate, edit, title = 'เลือกเพื่อนร่วมงาน' }: {
  onClose: () => void
  onCreate?: (form: AddFriendForm) => Promise<CreateFriendResult>
  edit?: EditFriendMode
  /** create-mode heading — the screen's pickLabel ("เลือกเพื่อนร่วมงาน" / "เลือกคู่รัก" …). Frame 720:25691 default. */
  title?: string
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
  // N2 — รูปเพื่อน: อัปไฟล์ไป object-storage ได้ s3_key (เดียวกับ modal-image-crop) แล้วส่งเป็น picture_url ตอน create.
  // preview เป็น object-URL ฝั่ง client เพื่อโชว์ทันที (ไม่ยิงอ่านกลับ). edit mode: ดู FLAG ท้ายไฟล์.
  const [imageKey, setImageKey] = useState('') // s3_key ที่อัปแล้ว → imageProfile
  const [imagePreview, setImagePreview] = useState('') // object URL สำหรับแสดง
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const [confirmingDelete, setConfirmingDelete] = useState(false) // N2: ยืนยันก่อนลบเพื่อน
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState(false)

  async function onConfirmDelete() {
    if (!edit?.onDelete) return
    setDeleting(true); setDeleteError(false)
    const res = await edit.onDelete()
    setDeleting(false)
    if (res.ok) setConfirmingDelete(false) // caller ปิด sheet เอง
    else setDeleteError(true)
  }

  // ปิด sheet ด้วย Escape (P1-5) — เดิมปิดได้แค่แตะ backdrop
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // N3 — validate วันตามเดือน/ปีจริง (คุม 31 ก.พ.): day ต้องไม่เกินจำนวนวันของเดือน/ปีที่เลือก
  const yearCE = /^\d{4}$/.test(yearBE) ? toGregorianYear(Number(yearBE)) : 0
  const maxDay = daysInMonth(Number(month), yearCE)
  const dayValid = /^\d{1,2}$/.test(day) && Number(day) >= 1 && Number(day) <= maxDay
  const dobValid = dayValid && !!month && /^\d{4}$/.test(yearBE)
  const dateOutOfRange = !!day && !!month && /^\d{4}$/.test(yearBE) && !dayValid
  const canSave = name.trim().length > 0 && dobValid && !saving && !uploading

  // N3 — เวลาเกิดเป็น select ชั่วโมง 0–23 + นาที 0–59 (state `time` = 'HH:mm', เก็บ zero-padded)
  // แปลงเป็นเลขไม่มี 0 นำ ให้ตรงกับ option value (String(h)); '07' → '7'
  const [rawH = '', rawM = ''] = time ? time.split(':') : []
  const hourStr = rawH === '' ? '' : String(Number(rawH))
  const minuteStr = rawM === '' ? '' : String(Number(rawM))
  const setHour = (h: string) => setTime(h === '' ? '' : `${h.padStart(2, '0')}:${(minuteStr || '0').padStart(2, '0')}`)
  const setMinute = (m: string) => setTime(`${(hourStr || '0').padStart(2, '0')}:${m.padStart(2, '0')}`)

  async function onPickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // ให้เลือกไฟล์เดิมซ้ำได้
    if (!file) return
    setUploading(true); setUploadError(false)
    try {
      const [{ callApiUpload }, { API }] = await Promise.all([import('@/utils/fetch'), import('@/constants/api/endpoint')])
      const formData = new FormData()
      formData.append('file', file)
      const res = await callApiUpload(API.object_storage.upload, 'POST', '', formData)
      if (res?.s3_key) {
        setImageKey(res.s3_key)
        setImagePreview(URL.createObjectURL(file))
      } else {
        setUploadError(true)
      }
    } catch {
      setUploadError(true)
    } finally {
      setUploading(false)
    }
  }

  async function submit() {
    if (!canSave) return
    setSaving(true); setError(false)
    const birthDay = `${toGregorianYear(Number(yearBE))}-${month.padStart(2, '0')}-${day.padStart(2, '0')}` // BE→CE 'YYYY-MM-DD'
    const form: AddFriendForm = {
      name: name.trim(),
      birthDay,
      time: noTime ? '' : time,
      isRememberTime: !noTime,
      imageProfile: imageKey, // N2: s3_key จากการอัปโหลด ('' ถ้าไม่ได้เลือกรูป) → v1 create's picture_url
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
      <div className="relative flex max-h-[90vh] w-full max-w-md flex-col gap-[18px] overflow-y-auto rounded-t-[28px] bg-v3-bg-cream px-5 pb-10 pt-3 font-ibm" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={edit ? 'แก้ไขข้อมูลเพื่อน' : 'เพิ่มเพื่อน'} data-testid="add-friend-sheet">
        <span aria-hidden className="mx-auto h-[5px] w-11 shrink-0 rounded-full bg-v3-border-warm-2" />
        {/* P1-5 — ปุ่มปิด (เดิมปิดได้แค่แตะ backdrop / Escape) */}
        <button type="button" onClick={onClose} aria-label="ปิด" data-testid="add-friend-close"
          className="absolute right-4 top-4 grid size-8 place-items-center rounded-full bg-white/70 text-v3-text-body">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M18 6 6 18M6 6l12 12" /></svg>
        </button>
        <h2 className="text-center text-[20px] font-bold leading-7 text-v3-navy">
          {edit ? 'แก้ไขข้อมูลเพื่อน' : title}
        </h2>

        <div className="flex w-full flex-col gap-5">
          <div className="flex flex-col gap-2">
            <Label>ชื่อเพื่อน</Label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="ใส่ชื่อเพื่อน" className={inputCls} data-testid="add-friend-name" />
          </div>

          <div className="flex w-full items-start gap-1">
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <Label>วันเกิด</Label>
              <select value={day} onChange={(e) => setDay(e.target.value)} required className={selectCls} style={CHEVRON_BG} data-testid="add-friend-day">
                <option value="" disabled>วว</option>
                {Array.from({ length: 31 }, (_, i) => <option key={i + 1} value={String(i + 1)}>{i + 1}</option>)}
              </select>
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <Label>เดือนเกิด</Label>
              <select value={month} onChange={(e) => setMonth(e.target.value)} required className={selectCls} style={CHEVRON_BG} data-testid="add-friend-month">
                <option value="" disabled>ดด</option>
                {TH_MONTHS.map((m, i) => <option key={i + 1} value={String(i + 1)}>{m}</option>)}
              </select>
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <Label>ปีเกิด (พ.ศ.)</Label>
              <select value={yearBE} onChange={(e) => setYearBE(e.target.value)} required className={selectCls} style={CHEVRON_BG} data-testid="add-friend-year">
                <option value="" disabled>ปปปป</option>
                {YEAR_OPTIONS_BE.map((y) => <option key={y} value={String(y)}>{y}</option>)}
              </select>
            </div>
          </div>
          {/* N3/P1-10 — วันที่ไม่มีจริง (เช่น 31 ก.พ.) */}
          {dateOutOfRange && (
            <p role="alert" data-testid="add-friend-date-error" className="text-[13px] font-medium text-v3-error">
              วันที่เลือกไม่มีอยู่จริงในเดือนนี้ กรุณาเลือกใหม่
            </p>
          )}

          <div className="flex flex-col gap-2">
            <Label>เวลาเกิด</Label>
            <div className="flex items-center gap-2">
              <select value={hourStr} onChange={(e) => setHour(e.target.value)} disabled={noTime} required className={`${selectCls} disabled:bg-v3-disabled-bg/40`} style={CHEVRON_BG} data-testid="add-friend-hour" aria-label="ชั่วโมง">
                <option value="" disabled>ชม.</option>
                {Array.from({ length: 24 }, (_, h) => <option key={h} value={String(h)}>{String(h).padStart(2, '0')}</option>)}
              </select>
              <span className="text-[16px] font-semibold text-v3-text-body">:</span>
              <select value={minuteStr} onChange={(e) => setMinute(e.target.value)} disabled={noTime} required className={`${selectCls} disabled:bg-v3-disabled-bg/40`} style={CHEVRON_BG} data-testid="add-friend-minute" aria-label="นาที">
                <option value="" disabled>นาที</option>
                {Array.from({ length: 60 }, (_, m) => <option key={m} value={String(m)}>{String(m).padStart(2, '0')}</option>)}
              </select>
            </div>
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

          {/* N2 — อัพโหลดรูปเพื่อน (frame 720:25751): เลือกไฟล์ → object-storage → s3_key → ส่งเป็น picture_url ตอน create.
              🔴 FLAG (edit mode): EditFriendForm ไม่มี imageProfile และ sheet นี้จงใจไม่ถือ friendId (ดู EditFriendMode)
              การเซฟรูปตอนแก้ไขต้องยิง MemberWithFriendUpdateApi(friendId, s3_key) จากฝั่ง caller — อยู่นอกขอบเขตไฟล์นี้ */}
          <input ref={fileRef} type="file" accept="image/*" hidden data-testid="add-friend-upload-input" onChange={onPickImage} />
          <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} data-testid="add-friend-upload"
            className="flex w-full items-center gap-3 overflow-hidden rounded-3xl bg-v3-ghost-white py-3 pl-3 pr-4 text-left disabled:opacity-60">
            <span className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-full border border-dashed border-v3-sapphire bg-white text-v3-sapphire">
              {imagePreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={imagePreview} alt="รูปเพื่อน" className="size-full object-cover" />
              ) : (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 15V4M8 8l4-4 4 4" /><path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" /></svg>
              )}
            </span>
            <span className="flex min-w-0 flex-col gap-1">
              <span className="text-[16px] font-bold uppercase leading-6 text-v3-sapphire">อัพโหลดรูป</span>
              <span className="truncate text-[14px] font-normal leading-[22px] text-v3-text-detail">
                {uploading ? 'กำลังอัปโหลด…' : uploadError ? 'อัปโหลดไม่สำเร็จ ลองอีกครั้ง' : imagePreview ? 'อัปโหลดแล้ว · แตะเพื่อเปลี่ยนรูป' : 'แตะเพื่อเลือกรูป'}
              </span>
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

          {/* N2 — ลบเพื่อนคนนี้ (เฉพาะโหมดแก้ไข และเมื่อ caller ส่ง onDelete มา) */}
          {edit?.onDelete && (
            <button type="button" onClick={() => setConfirmingDelete(true)} data-testid="add-friend-delete"
              className="w-full py-1 text-center text-[15px] font-bold text-v3-error">
              ลบเพื่อนคนนี้
            </button>
          )}
        </div>

        {/* create-only: connecting an account is a way to ADD friends, meaningless while editing one */}
        {!edit && <p className="text-center text-[16px] font-normal leading-6 text-[#9EA8B8]">หรือเชื่อมต่อบัญชี</p>}

        {/* 3 account-connect options (frame 720:25759) — no backend (done-cond #12): drawn per Figma, each a
            ComingSoonAction so the tap ANSWERS instead of a dead/greyed row. */}
        <div className={`w-full flex-col gap-2 ${edit ? 'hidden' : 'flex'}`}>
          {CONNECT_OPTIONS.map((o) => (
            <ComingSoonAction key={o.id} testId={`connect-${o.id}`} label={`${o.label} (เร็วๆ นี้)`} message="เชื่อมต่อบัญชีจะเปิดให้ใช้เร็วๆ นี้"
              className="flex h-16 w-full items-center gap-3.5 overflow-hidden rounded-3xl bg-white px-3.5 text-left">
              <span className={`grid size-9 shrink-0 place-items-center rounded-[10px] ${o.bg} text-white`} aria-hidden>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden><circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 4-6 8-6s8 2 8 6" /></svg>
              </span>
              <span className="flex-1 text-[14px] font-normal leading-[22px] text-v3-text-body">{o.label}</span>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#464646" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="shrink-0"><path d="m9 6 6 6-6 6" /></svg>
            </ComingSoonAction>
          ))}
        </div>

        {/* N2 — ยืนยันก่อนลบเพื่อน (destructive) */}
        {confirmingDelete && (
          <div className="absolute inset-0 z-10 grid place-items-center rounded-t-[28px] bg-black/40 px-6" role="dialog" aria-modal="true" aria-label="ยืนยันการลบเพื่อน" onClick={() => !deleting && setConfirmingDelete(false)}>
            <div className="w-full max-w-sm rounded-[24px] bg-white p-6 text-center" onClick={(e) => e.stopPropagation()} data-testid="add-friend-delete-confirm">
              <p className="text-[17px] font-bold text-v3-navy">ลบเพื่อนคนนี้?</p>
              <p className="mt-2 text-[14px] leading-[22px] text-v3-text-detail">ข้อมูลเพื่อนคนนี้จะถูกลบ กู้คืนไม่ได้</p>
              {deleteError && <p role="alert" className="mt-2 text-[13px] font-medium text-v3-error">ลบไม่สำเร็จ ลองใหม่อีกครั้ง</p>}
              <div className="mt-5 flex gap-3">
                <button type="button" onClick={() => setConfirmingDelete(false)} disabled={deleting} data-testid="add-friend-delete-cancel"
                  className="flex-1 rounded-full border border-v3-border-dropdown py-3 text-[15px] font-bold text-v3-navy disabled:opacity-50">ยกเลิก</button>
                <button type="button" onClick={onConfirmDelete} disabled={deleting} data-testid="add-friend-delete-confirm-btn"
                  className="flex-1 rounded-full bg-v3-error py-3 text-[15px] font-bold text-white disabled:opacity-60">{deleting ? 'กำลังลบ…' : 'ลบเพื่อน'}</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
