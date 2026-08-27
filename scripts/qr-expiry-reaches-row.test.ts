// #455 slice 1 — ฟันของ "ความจริงเดินทางจาก Omise ถึงแถว แล้วถึง /api/v2/payment/status"
//
// 🔴 MUTANT CONTRACT — signature = ข้อความที่ failure พูด (นิยามเดียวกับ #463)
//   MU1  readOutcome เลิกอ่าน expires_at            → "adapter carries the gateway's deadline" reddens
//   MU2  charge-flow ส่ง undefined แทน expiresAt     → "the flow hands the deadline to the row" reddens
//   MU3  attachChargeId เขียนค่าที่ parse ไม่ได้ลงไป → "an unparsable deadline is stored as null" reddens
//   MU4  attachChargeId เขียนทับด้วย null เมื่อไม่ส่ง → "omitting the argument leaves the column alone" reddens
//   MU5  qrDeadlineState ยุบ unknown ไปเป็น live      → "null is unknown, never live" reddens
//   MU6  qrDeadlineState ตอบ expired ให้ค่าที่ parse ไม่ได้ → "unparsable is unknown, never expired" reddens
//
// 🔑 ทำไมเทสต์นี้ยืนยัน "ไม่รู้ ≠ ยังไม่หมดอายุ" ด้วย:
// Omise ไม่ยิง event ตอนหมดอายุ (วัด 2026-08-27: 0 จาก 124 charge ที่ expired มี event อื่นนอกจาก
// charge.create) ⇒ แถวของเราคือที่เดียวที่ข้อเท็จจริงนี้อยู่ได้ · ถ้า null ถูกอ่านว่า "ยังดีอยู่"
// ผู้ใช้จะถูกบอกให้รอ QR ที่ตายไปแล้ว ซึ่งคือบั๊กที่ใบนี้เกิดมาเพื่อปิด
import { describe, it, expect, vi, afterEach } from 'vitest'
import { omiseGateway } from '@/lib/payment/omise-gateway'
import { OMISE_WEBHOOK_URL_ENV } from '@/lib/payment/webhook-endpoint'
import { qrDeadlineState } from '@/lib/payment/qr-deadline'

const GOOD_WEBHOOK = 'https://mumate.example.com/api/v2/payment/webhook'
const EXPIRES = '2026-08-27T10:05:00Z'

function mockOmise(responses: Record<string, unknown>[]) {
  let i = 0
  vi.stubGlobal('fetch', vi.fn(async () => {
    const body = responses[Math.min(i++, responses.length - 1)]
    return { ok: true, status: 200, json: async () => body } as unknown as Response
  }))
}

function withKeys() {
  vi.stubEnv('OMISE_SECRET_KEY', 'skey_test_x')
  vi.stubEnv(OMISE_WEBHOOK_URL_ENV, GOOD_WEBHOOK)
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('#455 ① adapter เลิกทิ้งวันหมดอายุที่ Omise ส่งมา', () => {
  it('🔴 adapter carries the gateway deadline off the promptpay charge (MU1)', async () => {
    withKeys()
    mockOmise([{ id: 'src_1' }, { id: 'chrg_1', source: {}, expires_at: EXPIRES }])

    const r = await omiseGateway.createPromptPayCharge({ amountSatang: 79000, email: 'a@b.co', orderId: 'o1' })

    // ค่าจริง ไม่ใช่แค่ "มีช่อง" — สะกดถูกแต่ค่าผิดต้องแดง
    expect(r.expiresAt).toBe(EXPIRES)
  })

  it('การ์ดไม่มีวันหมดอายุ ⇒ null ❌ ไม่ใช่ undefined ที่อ่านกำกวม', async () => {
    withKeys()
    mockOmise([{ id: 'chrg_card', paid: false, status: 'pending' }])

    const r = await omiseGateway.createCardCharge({ amountSatang: 79000, token: 't', email: 'a@b.co', orderId: 'o2' })

    expect(r.expiresAt).toBeNull()
  })

  it('Omise ส่งค่าที่ไม่ใช่สตริงมา ⇒ null ไม่ใช่ค่าขยะ', async () => {
    withKeys()
    mockOmise([{ id: 'src_1' }, { id: 'chrg_2', source: {}, expires_at: 12345 }])

    const r = await omiseGateway.createPromptPayCharge({ amountSatang: 1, email: 'a@b.co', orderId: 'o3' })

    expect(r.expiresAt).toBeNull()
  })
})

describe('#455 ② สามสถานะ — ไม่มี boolean ให้หยิบผิด', () => {
  const NOW = new Date('2026-08-27T12:00:00.000Z')

  it('🔴 null is unknown, never live (MU5)', () => {
    // เคสหลัก ไม่ใช่ขอบ: charge เก่า 124 จาก 184 ตัว และเลนบัตรทั้งเลน เป็น null
    expect(qrDeadlineState(null, NOW)).toBe('unknown')
    expect(qrDeadlineState(undefined, NOW)).toBe('unknown')
  })

  it('🔴 unparsable is unknown, never expired (MU6)', () => {
    // เดาไปทาง expired = บอกคนที่ QR ยังใช้ได้ให้ไปขอใหม่ = สร้างรายการที่สองโดยไม่จำเป็น
    expect(qrDeadlineState('ไม่ใช่วันที่', NOW)).toBe('unknown')
  })

  it('เลยเส้นตาย = expired · ยังไม่ถึง = live · ขอบพอดีนับเป็น expired', () => {
    expect(qrDeadlineState(new Date('2026-08-27T11:59:59.000Z'), NOW)).toBe('expired')
    expect(qrDeadlineState(new Date('2026-08-27T12:00:01.000Z'), NOW)).toBe('live')
    expect(qrDeadlineState(NOW, NOW), 'ถึงเวลาพอดี = สแกนไม่ได้แล้ว').toBe('expired')
  })

  it('รับได้ทั้ง Date และ ISO string — แถวจาก drizzle เป็น Date ส่วน JSON เป็นสตริง', () => {
    expect(qrDeadlineState('2026-08-27T11:00:00.000Z', NOW)).toBe('expired')
    expect(qrDeadlineState('2026-08-27T13:00:00.000Z', NOW)).toBe('live')
  })
})
