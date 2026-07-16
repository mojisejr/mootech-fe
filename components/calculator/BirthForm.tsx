import { useState } from 'react'
import Image from 'next/image'
import BirthDayInput from '@/components/birthday-input'

export type BirthFormValue = { dob: string; time: string; gender: 'MALE' | 'FEMALE' }

const todayIso = () => new Date().toISOString().slice(0, 10)

// F0 — "คำถาม ไม่ใช่ฟอร์มเก็บข้อมูล" (มุน). No name/email/login fields at all, ever.
export function BirthForm({ onSubmit, submitting }: { onSubmit: (v: BirthFormValue) => void; submitting?: boolean }) {
  const [dob, setDob] = useState(todayIso())
  const [time, setTime] = useState('')
  const [rememberTime, setRememberTime] = useState(true)
  const [gender, setGender] = useState<'MALE' | 'FEMALE' | null>(null)

  const canSubmit = !!dob && !!gender

  return (
    <form
      className="mx-auto w-full max-w-md rounded-2xl border border-border_gray bg-moumate_white p-6 shadow-custom"
      onSubmit={(e) => {
        e.preventDefault()
        if (!canSubmit || !gender) return
        onSubmit({ dob, time: rememberTime ? time : '', gender })
      }}
    >
      {/* small mumate brand mark, top-left — this form is intentionally mumate's, not a bare tool.
          ic_logo.svg is a white wordmark (built for the teal header), so it sits on a teal chip to
          stay legible on the white card. */}
      <div className="mb-3 flex justify-start">
        <span className="inline-flex items-center rounded-lg bg-moumate_blue px-2.5 py-1">
          <Image src="/images/mumate/ic_logo.svg" width={72} height={17} alt="mumate" />
        </span>
      </div>
      {/* font-prompt = promo/headline copy (มุน mood/tone direction, #calculator-badge-mood-FROZEN-v1) —
          distinct from font-chonburi (reserved for the ดิถี hero glyph only) and font-ibm (data labels). */}
      <h1 className="text-center font-prompt text-2xl font-semibold text-moumate_black">ผังชะตากำเนิดของคุณ</h1>
      <p className="mt-1 text-center font-ibm text-sm text-calc_muted">ใส่วันเกิดเพื่อเริ่ม</p>

      <div className="mt-6">
        <label className="mb-1 block font-ibm text-sm font-medium text-moumate_black">วันเกิด</label>
        <BirthDayInput dob={dob} onChangeDate={setDob} />
      </div>

      <div className="mt-4">
        <label className="mb-1 flex items-center justify-between font-ibm text-sm font-medium text-moumate_black">
          <span>เวลาเกิด</span>
          <span className="flex items-center gap-1.5 font-normal text-calc_muted">
            <input
              type="checkbox"
              checked={!rememberTime}
              onChange={(e) => setRememberTime(!e.target.checked)}
            />
            จำไม่ได้
          </span>
        </label>
        <input
          type="time"
          value={time}
          disabled={!rememberTime}
          onChange={(e) => setTime(e.target.value)}
          aria-label="เวลาเกิด"
          className="w-full rounded-[10px] border border-gray-200 bg-moumate_white p-[8px] font-ibm disabled:opacity-50"
        />
      </div>

      <div className="mt-4">
        <span className="mb-2 block font-ibm text-sm font-medium text-moumate_black">เพศ</span>
        <div className="grid grid-cols-2 gap-3">
          {(['MALE', 'FEMALE'] as const).map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => setGender(g)}
              className={
                (gender === g ? 'border-2 border-moumate_blue bg-moumate_blue_light ' : 'border border-gray-500 bg-white ') +
                'flex w-full items-center justify-center rounded-2xl p-3 font-ibm text-moumate_black'
              }
            >
              {g === 'MALE' ? '♂ ชาย' : '♀ หญิง'}
            </button>
          ))}
        </div>
      </div>

      <div className="relative mt-6">
        <button
          type="submit"
          disabled={!canSubmit || submitting}
          className="w-full rounded-2xl bg-moumate_blue py-3 font-ibm font-medium text-moumate_black disabled:opacity-50"
        >
          {submitting ? 'กำลังคำนวณ…' : 'ดูผังของฉัน'}
        </button>
        {!submitting && (
          <Image
            src="/images/mumate/ic_sparkles.svg"
            width={22}
            height={22}
            alt=""
            aria-hidden="true"
            className="pointer-events-none absolute -left-1.5 -top-2.5"
          />
        )}
      </div>
    </form>
  )
}
