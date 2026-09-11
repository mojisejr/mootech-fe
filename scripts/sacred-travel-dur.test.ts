// P3-16 — fmtDur: เวลาเดินทางต้องอ่านง่าย ไม่โชว์ "นาที" ดิบเป็นพัน (ที่ tester เห็นแล้วเขียนว่า "40 ชม.")
import { describe, it, expect } from 'vitest'
import { fmtDur, estMin } from '@/features/v2-service/sacred-map-shared'

describe('fmtDur', () => {
  it('< 60 นาที → นาที', () => {
    expect(fmtDur(1)).toBe('1 นาที')
    expect(fmtDur(45)).toBe('45 นาที')
  })
  it('ลงตัวชั่วโมง → ชม.', () => {
    expect(fmtDur(60)).toBe('1 ชม.')
    expect(fmtDur(120)).toBe('2 ชม.')
  })
  it('มีเศษ → ชม. + นาที', () => {
    expect(fmtDur(125)).toBe('2 ชม. 5 นาที')
  })
  it('เลขมหาศาลอ่านออก (เดินไกล) ไม่ใช่ "2400 นาที"', () => {
    // estMin(148km, walking 4.8) ≈ 2405 นาที → ~40 ชม.
    const min = estMin(148, 4.8)
    expect(fmtDur(min)).toMatch(/ชม\./)
    expect(fmtDur(min)).not.toBe(`${min} นาที`)
  })
})
