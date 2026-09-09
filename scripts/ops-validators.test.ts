// PURE validators ของ /ops (tier/QI/birth) — mirror รูปแบบ lib/ops/packages.ts validateEdit
import { describe, it, expect } from 'vitest'
import { validateTierEdit } from '@/lib/ops/tier'
import { validateQiEdit } from '@/lib/ops/qi'
import { validateBirthEdit } from '@/lib/ops/birth'

describe('validateTierEdit', () => {
  it('grant PRO ต้องมี expireAt ที่ถูกต้อง', () => {
    const r = validateTierEdit({ userId: 'u1', action: 'grant', tierCode: 'PRO', expireAt: '2027-01-01' })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.edit).toMatchObject({ action: 'grant', tierCode: 'PRO', expireAt: '2027-01-01' })
  })
  it('revoke ไม่ต้องมี tier/expire', () => {
    expect(validateTierEdit({ userId: 'u1', action: 'revoke' })).toMatchObject({ ok: true })
  })
  it('FREE ผ่าน grant ไม่ได้ (ใช้ revoke แทน)', () => {
    expect(validateTierEdit({ userId: 'u1', action: 'grant', tierCode: 'FREE', expireAt: '2027-01-01' })).toMatchObject({ ok: false, reason: 'BAD_TIER' })
  })
  it('วันหมดอายุผิดรูป → BAD_DATE', () => {
    expect(validateTierEdit({ userId: 'u1', action: 'grant', tierCode: 'PRO', expireAt: '01/01/2027' })).toMatchObject({ ok: false, reason: 'BAD_DATE' })
  })
  it('ไม่มี userId → BAD_USER', () => {
    expect(validateTierEdit({ userId: '', action: 'revoke' })).toMatchObject({ ok: false, reason: 'BAD_USER' })
  })
})

describe('validateQiEdit', () => {
  it('บวก/ลบ int ปกติผ่าน', () => {
    expect(validateQiEdit({ userId: 'u1', qiDelta: 100 })).toMatchObject({ ok: true })
    expect(validateQiEdit({ userId: 'u1', qiDelta: -50, note: 'refund' })).toMatchObject({ ok: true })
  })
  it('0 หรือเกิน cap → BAD_DELTA', () => {
    expect(validateQiEdit({ userId: 'u1', qiDelta: 0 })).toMatchObject({ ok: false, reason: 'BAD_DELTA' })
    expect(validateQiEdit({ userId: 'u1', qiDelta: 100001 })).toMatchObject({ ok: false, reason: 'BAD_DELTA' })
  })
  it('ไม่ใช่จำนวนเต็ม → BAD_DELTA', () => {
    expect(validateQiEdit({ userId: 'u1', qiDelta: 1.5 })).toMatchObject({ ok: false, reason: 'BAD_DELTA' })
  })
})

describe('validateBirthEdit', () => {
  it('วันเกิด+เวลาถูกต้องผ่าน', () => {
    const r = validateBirthEdit({ userId: 'u1', birth: '1993-11-24', birthTime: '15:09', timeUnknown: false })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.edit).toMatchObject({ birth: '1993-11-24', birthTime: '15:09', timeUnknown: false })
  })
  it('timeUnknown → birthTime เป็น null', () => {
    const r = validateBirthEdit({ userId: 'u1', birth: '1993-11-24', birthTime: '15:09', timeUnknown: true })
    expect(r.ok && r.edit.birthTime).toBe(null)
  })
  it('วันเกิดผิดรูป → BAD_DATE', () => {
    expect(validateBirthEdit({ userId: 'u1', birth: '24-11-1993' })).toMatchObject({ ok: false, reason: 'BAD_DATE' })
  })
  it('เวลาผิดรูป → BAD_TIME', () => {
    expect(validateBirthEdit({ userId: 'u1', birth: '1993-11-24', birthTime: '3pm', timeUnknown: false })).toMatchObject({ ok: false, reason: 'BAD_TIME' })
  })
})
