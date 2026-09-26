// scripts/bazi-share.test.ts — lib/v2/bazi-share.ts (ดวงธาตุที่แชร์ ฝังผังปาจื่อไปกับ fullText, เอ็ม 2026-09-26).
//
// 🔴 MUTANT CONTRACT — each case fails if the transport mechanism were absent/wrong:
//   B1 encode→extract คืน payload เดิม + prose ที่เหลือ (ไม่มี block ปน) ❌ block รั่วเข้า prose
//   B2 fullText ไม่มี block (ไพ่/เบอร์) → bazi=null, prose=ข้อความเดิม ❌ พังทั้ง reader
//   B3 block พัง/JSON เสีย → bazi=null แต่ prose ยังกู้ได้ ❌ throw ทั้งหน้า invite
//   B4 block มาก่อน prose เสมอ → slice(8000) ไม่ตัด block ทิ้ง (สัญญาฝั่ง writer)
import { describe, it, expect } from 'vitest'
import { encodeBaziShare, extractBaziShare, type BaziSharePayload } from '@/lib/v2/bazi-share'

const sample: BaziSharePayload = {
  headline: 'ธาตุไม้หยาง',
  tagline: 'ผู้สร้างและพัฒนาไม่หยุดนิ่ง',
  pillars: [
    { label: 'วัน', stem: '甲', stemInk: '#388659', stemEn: 'Yang Wood', branch: '午', branchInk: '#CB2C2A', branchEn: 'horse', hidden: [{ ch: '丁', ink: '#CB2C2A' }, { ch: '己', ink: '#F19953' }] },
  ],
  luck: [{ range: '43–52', current: true, phases: [{ range: '43–47', sym: '丙', ink: '#CB2C2A', band: 'ราศีบน', qi: 'ลิ้มกัว' }] }],
  years: [{ year: 2026, be: 2569, stem: { ch: '丙', ink: '#CB2C2A' }, branch: { ch: '午', ink: '#CB2C2A' }, qi: 'ซี', age: 'อายุ 46 ปี', clash: false, current: true }],
  elements: [{ th: 'ไม้', count: 2, role: 'เพื่อน/พี่น้อง/หุ้นส่วน', nisai: 'มีน้ำใจ ใจกว้าง', tint: '#e6f4ec', mascot: '/images/v2/destiny/el-wood.png' }],
}

describe('bazi-share transport', () => {
  it('B1: round-trips payload and returns the surrounding prose without the block', () => {
    const prose = 'บุคลิกพื้นฐาน...\n\nนิสัย...'
    const fullText = encodeBaziShare(sample) + '\n\n' + prose
    const out = extractBaziShare(fullText)
    expect(out.bazi).toEqual(sample)
    expect(out.prose).toBe(prose)
    expect(out.prose).not.toContain('@@MBZ@@')
    expect(out.prose).not.toContain('甲') // ตัวปาจื่ออยู่ใน block เท่านั้น ไม่ควรหลงมาใน prose ตัวอย่างนี้
  })

  it('B2: fullText without a block yields no bazi and the original text as prose', () => {
    const out = extractBaziShare('ไพ่ใบนี้บอกว่า...')
    expect(out.bazi).toBeNull()
    expect(out.prose).toBe('ไพ่ใบนี้บอกว่า...')
  })

  it('B3: a corrupt block degrades to null bazi but still recovers the prose', () => {
    const prose = 'คำทำนายเต็ม'
    const fullText = '@@MBZ@@{not valid json@@/MBZ@@\n\n' + prose
    const out = extractBaziShare(fullText)
    expect(out.bazi).toBeNull()
    expect(out.prose).toBe(prose)
  })

  it('B4: the encoded block carries the delimiters so the writer can place it before prose', () => {
    const enc = encodeBaziShare(sample)
    expect(enc.startsWith('@@MBZ@@')).toBe(true)
    expect(enc.endsWith('@@/MBZ@@')).toBe(true)
  })

  it('handles null/empty fullText', () => {
    expect(extractBaziShare(null)).toEqual({ bazi: null, prose: '' })
    expect(extractBaziShare('')).toEqual({ bazi: null, prose: '' })
  })
})
