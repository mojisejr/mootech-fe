// scripts/qi-earn-allowlist.test.ts — POST /api/qi-earn รับเฉพาะรหัสที่ "ผู้ใช้กดเองโดยชอบ" (ปิดช่องโหว่ · ประชุม 24 พ.ย. ข้อ 2)
//
// 🔴 MUTANT CONTRACT:
//   QA1 เดิมปฏิเสธแค่ line_oa_add → คนล็อกอินยิง wuxing_matrix (1,000 ชี) / referral_* พร้อม ref มั่ว / signup ได้เอง
//       เพราะ engine กันแค่ "จ่ายซ้ำ" ❌ ต้องเป็น allowlist: ทุกรหัสนอกรายการ → 403 และไม่ยิงไป engine
//   QA2 รหัสที่หน้าเว็บยิงเองจริง (daily_login · share · install_pwa) ต้องยังส่งต่อให้ engine ได้ตามเดิม
//   QA3 ไม่มี session → 401 ก่อนจะดูรหัสเลย
import { describe, it, expect, vi, beforeEach } from 'vitest'

const h = vi.hoisted(() => ({ session: null as null | { userId: string }, calls: [] as Array<{ url: string; body: unknown }> }))

vi.mock('@/lib/v2/resolve-user', () => ({
  resolveRouteMember: vi.fn(async () =>
    h.session
      ? { ok: true, userId: h.session.userId }
      : { ok: false, status: 401, body: { code: 'not_authenticated', error: 'not signed in' } }),
}))
vi.mock('@/lib/bazi/fetch', () => ({
  baziFetch: vi.fn(async (url: string, init?: { body?: string }) => {
    h.calls.push({ url: String(url), body: init?.body ? JSON.parse(init.body) : null })
    return { ok: true, status: 200, json: async () => ({ awarded: true, qi: 10, capped: false }) }
  }),
}))

import handler from '@/pages/api/qi-earn'

const ME = '11111111-1111-4111-8111-111111111111'

async function post(code: string, ref?: string) {
  const out = { status: 200, body: undefined as unknown }
  const res: Record<string, unknown> = {
    statusCode: 200,
    status(c: number) { out.status = c; return res },
    json(b: unknown) { out.body = b; return res },
  }
  await handler({ method: 'POST', body: { code, ref }, cookies: {}, headers: {}, query: {} } as never, res as never)
  return out
}

beforeEach(() => {
  h.session = { userId: ME }
  h.calls.length = 0
})

describe('/api/qi-earn — allowlist', () => {
  it('🔴 QA3 ไม่มี session → 401 ไม่ยิงไป engine', async () => {
    h.session = null
    const out = await post('daily_login')
    expect(out.status).toBe(401)
    expect(h.calls).toEqual([])
  })

  it('🔴 QA1 รหัสที่ควรมาจากระบบ → 403 และไม่ส่งต่อให้ engine', async () => {
    for (const code of ['line_oa_add', 'signup', 'referral_free', 'referral_plus', 'referral_pro', 'wuxing_matrix', 'first_buy_bonus', 'friend_reading', 'anything_else']) {
      h.calls.length = 0
      const out = await post(code, code.startsWith('referral') ? 'made-up-invitee' : undefined)
      expect(out.status, code).toBe(403)
      expect(h.calls, code).toEqual([])
    }
  })

  it('🔴 QA2 รหัสที่หน้าเว็บยิงเองจริง → ส่งต่อให้ engine พร้อม anonId ของ session', async () => {
    for (const code of ['daily_login', 'share', 'install_pwa']) {
      h.calls.length = 0
      const out = await post(code)
      expect(out.status, code).toBe(200)
      expect(h.calls[0], code).toMatchObject({ url: expect.stringContaining('/api/qi/earn'), body: { anonId: ME, code } })
    }
  })

  it('ref ถูกตัดไม่เกิน 200 ตัวอักษรและส่งตามเฉพาะเส้นอนุญาต', async () => {
    const out = await post('share', 'x'.repeat(500))
    expect(out.status).toBe(200)
    expect(((h.calls[0].body as { ref?: string }).ref ?? '').length).toBe(200)
  })

  it('รหัสรูปแบบไม่ถูก → 400', async () => {
    for (const code of ['', 'has space', 'x'.repeat(65), 'bad-code!']) {
      expect((await post(code)).status, JSON.stringify(code)).toBe(400)
    }
    expect(h.calls).toEqual([])
  })
})
