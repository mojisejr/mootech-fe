// safeNextPath — กัน open-redirect ของ ?next หลังล็อกอิน (โปรฯ landing, เอ็ม 2026-09-28)
import { describe, it, expect } from 'vitest'
import { safeNextPath } from '@/features/auth/hooks/useV2Login'

describe('safeNextPath', () => {
  it('ยอมรับ path ภายในเว็บ (รวม query ของ checkout)', () => {
    expect(safeNextPath('/v2/shop/checkout?package_code=V2_PRO_YEARLY&code=MUMATE100'))
      .toBe('/v2/shop/checkout?package_code=V2_PRO_YEARLY&code=MUMATE100')
    expect(safeNextPath('/v2')).toBe('/v2')
  })
  it('ปฏิเสธ redirect ออกนอกเว็บ / รูปแบบอันตราย', () => {
    expect(safeNextPath('//evil.com')).toBeNull()
    expect(safeNextPath('https://evil.com')).toBeNull()
    expect(safeNextPath('http://evil.com/v2')).toBeNull()
    expect(safeNextPath('/\\evil.com')).toBeNull()
    expect(safeNextPath('v2/shop')).toBeNull() // ไม่ขึ้นต้นด้วย '/'
  })
  it('ไม่มี/ผิดชนิด → null (ใช้ default /v2)', () => {
    expect(safeNextPath(undefined)).toBeNull()
    expect(safeNextPath('')).toBeNull()
    expect(safeNextPath(['/v2'])).toBeNull()
  })
})
