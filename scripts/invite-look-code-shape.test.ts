// scripts/invite-look-code-shape.test.ts — รูปแบบโค้ดแนะนำเพื่อนที่ /api/invite-look และ /invite/[code] ยอมรับ
//
// 🔴 MUTANT CONTRACT:
//   C1 โค้ดใหม่ 5 หลักขึ้นไปต้องถูกส่งต่อไปถาม Bazi ❌ ตอบ 400 เพราะตัวตรวจยังรับแค่ 3 หลัก
//      (โค้ด 3 หลักมีได้ 900 ค่า และถูกใช้ครบเมื่อ 2026-11-17)
//   C2 โค้ดเก่า 3 หลักยังใช้ได้เหมือนเดิม ❌ ลิงก์ชวนเพื่อนที่แชร์ไปแล้วเสีย
//   C3 โค้ดผิดรูปแบบตอบ 400 โดยไม่เรียก Bazi
import type { NextApiRequest, NextApiResponse } from 'next'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const baziFetch = vi.hoisted(() => vi.fn())
vi.mock('@/lib/bazi/fetch', () => ({ baziFetch }))

import handler from '@/pages/api/invite-look'
import { REFERRAL_CODE_RE } from '@/lib/v2/referral-code'

function call(code: string) {
  const out = { status: 0, body: undefined as unknown }
  const res = {
    status(code: number) { out.status = code; return res },
    json(body: unknown) { out.body = body; return res },
  } as unknown as NextApiResponse
  return handler({ method: 'GET', query: { code } } as unknown as NextApiRequest, res).then(() => out)
}

describe('referral code shape', () => {
  beforeEach(() => {
    baziFetch.mockReset().mockImplementation(async (url: string) => ({
      ok: true,
      status: 200,
      json: async () => ({ code: new URL(url).searchParams.get('code'), inviterName: 'somsri_m' }),
    }))
  })

  it('C1 forwards a new five-digit code and longer ones', async () => {
    for (const code of ['MUMATE45678', 'mumate654321', 'MUMATE12345678']) {
      const out = await call(code)
      expect(out.status).toBe(200)
      expect(out.body).toEqual({ code: code.toUpperCase(), inviterName: 'somsri_m' })
    }
    expect(baziFetch).toHaveBeenCalledTimes(3)
  })

  it('C2 still forwards an old three-digit code', async () => {
    const out = await call('MUMATE725')
    expect(out.status).toBe(200)
    expect(String(baziFetch.mock.calls[0][0])).toContain('/api/referral?code=MUMATE725')
  })

  it('C3 refuses malformed codes without asking Bazi', async () => {
    for (const code of ['', 'MUMATE', 'MUMATE12', 'MUMATE123456789', 'MUMATE12A45', 'XMUMATE12345', 'MUMATE 12345']) {
      expect((await call(code)).status).toBe(400)
    }
    expect(baziFetch).not.toHaveBeenCalled()
  })

  it('the shared pattern accepts three to eight digits and nothing else', () => {
    expect(REFERRAL_CODE_RE.test('MUMATE100')).toBe(true)
    expect(REFERRAL_CODE_RE.test('MUMATE10000')).toBe(true)
    expect(REFERRAL_CODE_RE.test('MUMATE99')).toBe(false)
    expect(REFERRAL_CODE_RE.flags).toBe('')
  })
})
