// #359 (ซินแสนุ้ย 2026-09-15) — CTA ต่อใบบนการ์ดบริการ (services.ts). เดิม hardcode "ดูดวงเลย" ทุกใบ;
// เจ้าของสั่งให้แต่ละใบมีคำกริยาของตัวเอง (แมทช์ดวงเลย/สั่งทำเลย/เปิดไพ่เลย/…). ทดสอบที่ตัว data (pure).
import { describe, it, expect } from 'vitest'
import { SERVICES } from '@/features/v2-service/services'

const EXPECTED: Record<string, string> = {
  couple: 'แมทช์ดวงเลย',
  coworker: 'แมทช์ดวงเลย',
  'one-book': 'สั่งทำเลย',
  'oracle-kiang': 'เปิดไพ่เลย',
  'spirit-heaven': 'เปิดไพ่เลย',
  sian: 'เสี่ยงทายเลย',
  sinsae: 'ดูดวงเลย',
  manifest: 'เริ่มมานิเฟส',
  calendar: 'เช็กวันมงคล',
  'sacred-map': 'ค้นหาพิกัด',
  'phone-number': 'วิเคราะห์เลย',
  shop: 'Shop Now',
}

describe('service card CTA ต่อใบ (#359)', () => {
  it('การ์ดหลักแต่ละใบมี cta ตามที่เจ้าของกำหนด', () => {
    const byId = Object.fromEntries(SERVICES.map((s) => [s.id, s]))
    for (const [id, cta] of Object.entries(EXPECTED)) {
      expect(byId[id], `service ${id} must exist`).toBeTruthy()
      expect(byId[id].cta, `cta ของ ${id}`).toBe(cta)
    }
  })

  it('couple/coworker ชี้ไปหน้าเปรียบเทียบเฉพาะ (ไม่ใช่ hub รวม)', () => {
    const byId = Object.fromEntries(SERVICES.map((s) => [s.id, s]))
    expect(byId['couple'].href).toBe('/v2/service/compatibility/love')
    expect(byId['coworker'].href).toBe('/v2/service/compatibility/colleague')
  })
})
