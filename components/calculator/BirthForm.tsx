import { useState } from 'react'
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
      <h1 className="font-chonburi text-2xl text-moumate_black">ผังชะตากำเนิดของคุณ</h1>
      <p className="mt-1 font-ibm text-sm text-calc_muted">ใส่วันเกิดเพื่อเริ่ม</p>

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

      <button
        type="submit"
        disabled={!canSubmit || submitting}
        className="mt-6 w-full rounded-2xl bg-moumate_blue py-3 font-ibm font-medium text-moumate_black disabled:opacity-50"
      >
        {submitting ? 'กำลังคำนวณ…' : 'ดูผังของฉัน'}
      </button>
    </form>
  )
}
