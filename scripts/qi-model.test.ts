// scripts/qi-model.test.ts — teeth ของ helpers กลางระบบชี่ (features/v2-qi/qi-model.ts)
//
// สิ่งที่ต้องไม่พัง: การตัดรอบ "วัน" ต้องเป็นเขต Asia/Bangkok เสมอ (engine ตัดรอบ daily ด้วย
// todayBangkok ฝั่งตัวเอง) — ถ้า FE เทียบวันที่ UTC ตรง ๆ จะโชว์ "เช็คอินแล้ว" ผิดวันช่วงหลังเที่ยงคืน
import { describe, expect, it } from 'vitest'
import { bangkokDay, checkedInToday, reasonLabel, todayBangkok } from '@/features/v2-qi/qi-model'

const row = (reason: string | null, createdAt: string) => ({ id: 1, qiDelta: 5, reason, createdAt })

describe('todayBangkok/bangkokDay — วันตัดรอบเป็นเขตไทยเสมอ', () => {
  it('แปลง timestamp UTC ช่วงหลังเที่ยงคืนไทยเป็น "วันถัดไป" ตามเขตไทย', () => {
    // 2026-09-03T18:00:00Z = 2026-09-04 01:00 น. ไทย — slice ตัวอักษรได้ 09-03 แต่ไทยคือ 09-04
    expect(bangkokDay('2026-09-03T18:00:00.000Z')).toBe('2026-09-04')
  })

  it('todayBangkok ให้รูปแบบ YYYY-MM-DD', () => {
    expect(todayBangkok(new Date('2026-09-03T00:30:00.000Z'))).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

describe('checkedInToday — สถานะเช็คอินอ่านจากประวัติวันนี้ (เขตไทย)', () => {
  it('แถว daily_login ของ "วันนี้แบบไทย" (แม้ UTC ยังเป็นเมื่อวาน) นับว่าเช็คอินแล้ว', () => {
    // 2026-09-02T18:30Z = 01:30 น. ไทยของวันที่ 3 — เทียบกับวันที่ 3 (ไทย) ต้องนับ
    const history = [row('qi:earn:daily_login', '2026-09-02T18:30:00.000Z')]
    expect(checkedInToday(history, '2026-09-03')).toBe(true)
  })

  it('แถว daily_login ของเมื่อวาน (ไทย) ยังไม่นับ — ต้องเช็คอินใหม่', () => {
    const history = [row('qi:earn:daily_login', '2026-09-01T18:30:00.000Z')] // = 01:30 ไทย วันที่ 2
    expect(checkedInToday(history, '2026-09-03')).toBe(false)
  })

  it('แถวอื่น (share/mission) ไม่นับเป็นเช็คอิน · ประวัติว่าง = ยังไม่เช็คอิน', () => {
    expect(checkedInToday([row('qi:earn:share', '2026-09-03T00:00:00.000Z')], '2026-09-03')).toBe(false)
    expect(checkedInToday([], '2026-09-03')).toBe(false)
    expect(checkedInToday(undefined, '2026-09-03')).toBe(false)
  })
})

describe('reasonLabel — reason ดิบของ ledger เป็นข้อความไทย', () => {
  const titles = new Map([['checkin_mu', 'ภารกิจเช็คอินมู']])

  it('qi:earn/spend/refund + referral อ่านออกเป็นภาษาคน', () => {
    expect(reasonLabel('qi:earn:daily_login')).toBe('เช็คอินรายวัน')
    expect(reasonLabel('qi:spend:chat_question')).toBe('แลก ถาม AI')
    expect(reasonLabel('qi:refund:card_use')).toBe('คืนแต้ม — เปิดการ์ด/เสี่ยงทาย ล้ม')
    expect(reasonLabel('referral:inviter')).toBe('เพื่อนใช้โค้ดของคุณ')
    expect(reasonLabel('referral:referee')).toBe('ใช้โค้ดแนะนำสำเร็จ')
  })

  it('mission:<id> ใช้ชื่อจาก board ถ้าส่งมา, ไม่ส่งก็ยังอ่านออก', () => {
    expect(reasonLabel('mission:checkin_mu', titles)).toBe('ภารกิจเช็คอินมู')
    expect(reasonLabel('mission:checkin_mu')).toBe('ภารกิจ checkin_mu')
  })

  it('reason แปลก/ว่างไม่พัง', () => {
    expect(reasonLabel(null)).toBe('ภารกิจ')
    expect(reasonLabel('something_else')).toBe('something_else')
  })
})
