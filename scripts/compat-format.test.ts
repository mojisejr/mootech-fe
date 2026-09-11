// P3-17 — teeth for compat-format.ts after it was consolidated onto lib/v2/thai-date.ts.
// เดิมไฟล์นี้ไม่มี test เลย (จึงไม่ถูก refactor) — เพิ่มเพื่อคุมการ delegate ให้ผลลัพธ์เดิมเป๊ะ.
import { describe, it, expect } from 'vitest'
import { formatCompatBirth } from '@/features/v2-service/components/compat-format'
import { toBuddhistYear, toGregorianYear } from '@/lib/v2/thai-date'

describe('formatCompatBirth (delegates to formatThaiDateAbbr)', () => {
  it('dob + time → "14 มิ.ย. 2537 · 09:30 น."', () => {
    expect(formatCompatBirth('1994-06-14', '09:30')).toBe('14 มิ.ย. 2537 · 09:30 น.')
  })
  it('dob ไม่มีเวลา → ตัดหาง "· … น." ทิ้ง', () => {
    expect(formatCompatBirth('1994-06-14', '')).toBe('14 มิ.ย. 2537')
  })
  it('dob ว่าง/ผิดรูปแบบ → "" (ไม่เดา)', () => {
    expect(formatCompatBirth('', '09:30')).toBe('')
    expect(formatCompatBirth('1994/06/14', '09:30')).toBe('')
  })
})

describe('toBuddhistYear / toGregorianYear (single home ของ 543)', () => {
  it('ค.ศ.↔พ.ศ. ไป-กลับได้ค่าเดิม', () => {
    expect(toBuddhistYear(1994)).toBe(2537)
    expect(toGregorianYear(2537)).toBe(1994)
    expect(toGregorianYear(toBuddhistYear(2000))).toBe(2000)
  })
})
