// scripts/friend-reading-route.test.ts — BFF ดูดวงเพื่อน /api/v2/friends/reading + กติกา (ประชุม 24 พ.ย. ข้อ 2)
//
// 🔴 MUTANT CONTRACT (each reddens `npm test`):
//   FR1 เปิดหน้า (GET) ต้องไม่คำนวณและไม่หักชี — ถามราคาอย่างเดียว
//   FR2 คำนวณก่อน หักทีหลัง: engine คำนวณล้ม → 502 และไม่ยิง /api/qi/spend เด็ดขาด
//   FR3 หักไม่ได้ (409) → 402 พร้อมยอดจริง และ response ไม่มีดวงติดมา (ไม่มีทางได้ดวงฟรี)
//   FR4 Pro: คนที่ 1–10 ฟรี (บันทึกสล็อต ไม่หักชี) · คนที่ 11 หัก 30 ชี · คนที่อยู่ในสล็อตแล้วดูซ้ำฟรี
//   FR5 ตารางสล็อตยังไม่พร้อม → Pro ได้ 503 (ไม่หักชี) · Free/Plus ใช้ได้ปกติ (ไม่พึ่งตาราง)
//   FR6 อ่านได้เฉพาะเพื่อนในรายชื่อของตัวเอง: where ต้องมีทั้ง id และ user_id · ไม่มี session → 401 ไม่แตะอะไร
//   FR7 วันเกิดใช้คำนวณไม่ได้ → 422 ก่อนเรียก engine
import { describe, it, expect, vi, beforeEach } from 'vitest'

const h = vi.hoisted(() => ({
  session: null as null | { userId: string },
  friendRow: undefined as Record<string, unknown> | undefined,
  userRow: undefined as Record<string, unknown> | undefined,
  friendTable: null as unknown,
  wheres: [] as unknown[],
  membership: { isPaid: false, tier: null as string | null },
  slots: { ids: [] as string[], down: false, insertOk: true, insertThrows: false, taken: [] as Array<{ userId: string; friendId: string }> },
  calcOk: true,
  essenceOk: true,
  spendStatus: 200,
  walletQi: 120,
  calls: [] as Array<{ url: string; method: string; body: unknown }>,
}))

vi.mock('@/lib/db', () => ({
  db: {
    select: () => ({
      from: (table: unknown) => ({
        where: (w: unknown) => ({
          limit: async () => {
            h.wheres.push({ table, w })
            return table === h.friendTable ? (h.friendRow ? [h.friendRow] : []) : h.userRow ? [h.userRow] : []
          },
        }),
      }),
    }),
  },
}))

vi.mock('@/lib/db/schema', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/db/schema')>()
  h.friendTable = actual.memberWithFriend
  return actual
})

vi.mock('@/lib/bazi/fetch', () => ({
  baziFetch: vi.fn(async (url: string, init?: { method?: string; body?: string }) => {
    const u = String(url)
    const method = init?.method ?? 'GET'
    h.calls.push({ url: u, method, body: init?.body ? JSON.parse(init.body) : null })
    const json = (b: unknown, status = 200) => ({ ok: status < 400, status, json: async () => b })
    if (u.includes('/api/qi/wallet')) return json({ qi: h.walletQi })
    if (u.includes('/api/reading/reading-essence')) return h.essenceOk ? json(ESSENCE) : json({ error: 'boom' }, 500)
    if (u.includes('/api/qi/spend')) return h.spendStatus === 200 ? json({ code: 'friend_reading', spentQi: 30, qi: 7 }) : json({ error: h.spendStatus === 409 ? 'แต้ม Qi ไม่พอ' : 'boom' }, h.spendStatus)
    return json({}, 404)
  }),
}))

vi.mock('@/lib/chart/engine-chart', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/chart/engine-chart')>()
  return { ...actual, fetchPublicCalc: vi.fn(async () => { if (!h.calcOk) throw new actual.EngineChartError('public-calc unreachable'); return CALC }) }
})

vi.mock('@/lib/v2/resolve-user', () => ({
  resolveRouteMember: vi.fn(async (req: { cookies?: Record<string, string> }) =>
    h.session
      ? { ok: true, userId: h.session.userId }
      : { ok: false, status: 401, body: { code: 'not_authenticated', error: 'not signed in' } }),
}))

vi.mock('@/lib/v2/subscription', () => ({
  resolveSubscription: vi.fn(async () => h.membership),
}))

vi.mock('@/lib/bazi-bridge/engine-birth', () => ({
  mergeEngineBirth: vi.fn(async (_id: string, row: unknown) => row),
}))

vi.mock('@/lib/v2/friend-reading-slots', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/v2/friend-reading-slots')>()
  return {
    ...actual,
    friendSlotState: vi.fn(async (_userId: string, friendId: string) => {
      if (h.slots.down) throw new actual.FriendSlotStoreUnavailable()
      return { already: h.slots.ids.includes(friendId), used: h.slots.ids.length }
    }),
    takeFriendSlot: vi.fn(async (userId: string, friendId: string) => {
      if (h.slots.insertThrows) throw new actual.FriendSlotStoreUnavailable()
      h.slots.taken.push({ userId, friendId })
      if (!h.slots.insertOk) return false
      h.slots.ids.push(friendId)
      return true
    }),
  }
})

import handler from '@/pages/api/v2/friends/reading'
import { friendReadingPlan, FRIEND_READING_CODE, FRIEND_READING_QI, PRO_FREE_FRIENDS } from '@/features/v2-friends/reading-policy'

const ME = '11111111-1111-4111-8111-111111111111'
const CALC = {
  dayMaster: '癸',
  pillars: {
    year: { stem: '丁', branch: '未', stemElement: 'ไฟ', branchElement: 'ดิน' },
    month: { stem: '壬', branch: '子', stemElement: 'น้ำ', branchElement: 'น้ำ' },
    day: { stem: '癸', branch: '丑', stemElement: 'น้ำ', branchElement: 'ดิน' },
    hour: { stem: '戊', branch: '午', stemElement: 'ดิน', branchElement: 'ไฟ' },
  },
}
const ESSENCE = { prediction: { personality: 'P', habit: 'H', love: 'L' }, cautions: ['c1'], deity: 'D', luck: { year: { label: 'Y', text: 'yt' }, month: null } }
const friend = (over: Record<string, unknown> = {}) => ({
  id: 'f1', userId: ME, name: 'สมศรี', surname: '', pictureUrl: null, memberId: '', member: '',
  dob: '1995-06-15', time: '09:30', isRememberTime: true, gender: 'FEMALE', placeName: '',
  ...over,
})

async function call(method: 'GET' | 'POST', opts: { id?: string; body?: unknown } = {}) {
  const out = { status: 200, body: undefined as unknown }
  const res: Record<string, unknown> = {
    statusCode: 200,
    status(c: number) { out.status = c; return res },
    json(b: unknown) { out.body = b; return res },
    setHeader() { return res },
  }
  const req = { method, query: opts.id !== undefined ? { id: opts.id } : {}, body: opts.body ?? {}, cookies: {}, headers: {} }
  await handler(req as never, res as never)
  return out
}
const engineCalls = (part: string) => h.calls.filter((c) => c.url.includes(part))

/** คอลัมน์+ค่าที่ปรากฏใน where ของ drizzle (เดิน queryChunks) — ใช้พิสูจน์ว่า route กรองทั้ง id และเจ้าของ */
function whereParts(w: unknown): { columns: string[]; values: unknown[] } {
  const columns: string[] = []
  const values: unknown[] = []
  const seen = new Set<object>() // วัตถุของ drizzle อ้างกันเป็นวง (column.table ↔ columns) กันเดินซ้ำ
  const walk = (n: unknown): void => {
    if (!n || typeof n !== 'object' || seen.has(n)) return
    seen.add(n)
    if (Array.isArray(n)) return n.forEach(walk)
    const ctor = (n as object).constructor?.name
    if (ctor === 'Param') values.push((n as { value: unknown }).value)
    if (ctor === 'StringChunk') return
    if (typeof (n as { name?: unknown }).name === 'string' && (n as { table?: unknown }).table) columns.push((n as { name: string }).name)
    for (const v of Object.values(n)) if (v && typeof v === 'object') walk(v)
  }
  walk(w)
  return { columns, values }
}

beforeEach(() => {
  h.session = { userId: ME }
  h.friendRow = friend()
  h.userRow = undefined
  h.wheres.length = 0
  h.membership = { isPaid: false, tier: null }
  h.slots = { ids: [], down: false, insertOk: true, insertThrows: false, taken: [] }
  h.calcOk = true
  h.essenceOk = true
  h.spendStatus = 200
  h.walletQi = 120
  h.calls.length = 0
})

describe('กติกา friendReadingPlan (pure)', () => {
  it('Pro: สล็อตที่เหลืออยู่ → ใช้สล็อตใหม่ฟรี · ครบ 10 แล้ว → 30 ชี · อยู่ในสล็อตแล้ว → ฟรี', () => {
    expect(FRIEND_READING_QI).toBe(30)
    expect(PRO_FREE_FRIENDS).toBe(10)
    expect(FRIEND_READING_CODE).toBe('friend_reading')
    expect(friendReadingPlan({ isPro: true, slotsUsed: 0, alreadySlotted: false })).toEqual({ basis: 'new_slot', priceQi: 0, freeUsedAfter: 1 })
    expect(friendReadingPlan({ isPro: true, slotsUsed: 9, alreadySlotted: false })).toEqual({ basis: 'new_slot', priceQi: 0, freeUsedAfter: 10 })
    expect(friendReadingPlan({ isPro: true, slotsUsed: 10, alreadySlotted: false })).toEqual({ basis: 'qi', priceQi: 30, freeUsedAfter: 10 })
    expect(friendReadingPlan({ isPro: true, slotsUsed: 10, alreadySlotted: true })).toEqual({ basis: 'slot', priceQi: 0, freeUsedAfter: 10 })
  })

  it('Plus/Free ไม่มีสล็อตฟรี แม้เคยมีแถวสล็อตตกค้าง → 30 ชีทุกครั้ง', () => {
    expect(friendReadingPlan({ isPro: false, slotsUsed: 3, alreadySlotted: true })).toMatchObject({ basis: 'qi', priceQi: 30 })
    expect(friendReadingPlan({ isPro: false, slotsUsed: 0, alreadySlotted: false })).toMatchObject({ basis: 'qi', priceQi: 30 })
  })
})

describe('GET /api/v2/friends/reading — ใบเสนอราคา', () => {
  it('🔴 FR1 ถามราคา: ไม่คำนวณ ไม่หักชี — ไม่มีคำขอไปหา engine เลย', async () => {
    const out = await call('GET', { id: 'f1' })
    expect(out.status).toBe(200)
    const body = out.body as { friend: { name: string }; plan: { basis: string; priceQi: number }; balance: number; freeSlots: unknown; canCompute: boolean }
    expect(body.friend.name).toBe('สมศรี')
    expect(body.plan).toMatchObject({ basis: 'qi', priceQi: 30 })
    expect(body.freeSlots).toBeNull()
    expect(body.canCompute).toBe(true)
    expect(engineCalls('/api/qi/spend')).toEqual([])
    expect(engineCalls('/api/reading/reading-essence')).toEqual([])
    expect(h.slots.taken).toEqual([])
  })

  it('ยอดชีในใบเสนอราคามาจากกระเป๋าจริงของ engine', async () => {
    const out = await call('GET', { id: 'f1' })
    expect((out.body as { balance: number }).balance).toBe(120)
    expect(engineCalls('/api/qi/wallet').length).toBe(1)
  })

  it('FR6 ไม่มี session → 401 ไม่แตะ DB/engine', async () => {
    h.session = null
    const out = await call('GET', { id: 'f1' })
    expect(out.status).toBe(401)
    expect(h.wheres.length).toBe(0)
    expect(h.calls.length).toBe(0)
  })

  it('FR6 ไม่ใช่เพื่อนในรายชื่อของเรา → 404 และ where กรองทั้ง id และ user_id', async () => {
    h.friendRow = undefined
    const out = await call('GET', { id: 'someone-elses' })
    expect(out.status).toBe(404)
    const parts = whereParts((h.wheres[0] as { w: unknown }).w)
    expect(parts.columns).toEqual(expect.arrayContaining(['id', 'user_id']))
    expect(parts.values).toEqual(expect.arrayContaining(['someone-elses', ME]))
  })

  it('id รูปแบบไม่ถูก → 400 ก่อนเข้า DB', async () => {
    const out = await call('GET', { id: "../etc' OR 1=1 --" })
    expect(out.status).toBe(400)
    expect(h.wheres.length).toBe(0)
  })

  it('FR4 Pro ใช้สล็อตไป 3 → basis new_slot + freeSlots {used:3,max:10}', async () => {
    h.membership = { isPaid: true, tier: 'PRO' }
    h.slots.ids = ['a', 'b', 'c']
    const out = await call('GET', { id: 'f1' })
    expect((out.body as { plan: { basis: string } }).plan.basis).toBe('new_slot')
    expect((out.body as { freeSlots: unknown }).freeSlots).toEqual({ used: 3, max: 10 })
  })

  it('FR5 Pro + ตารางสล็อตยังไม่พร้อม → 503 · Free ไม่พึ่งตารางจึงได้ 200 ตามปกติ', async () => {
    h.membership = { isPaid: true, tier: 'PRO' }
    h.slots.down = true
    expect((await call('GET', { id: 'f1' })).status).toBe(503)
    h.membership = { isPaid: false, tier: 'FREE' }
    expect((await call('GET', { id: 'f1' })).status).toBe(200)
  })

  it('Plus ไม่ได้สิทธิ์ Pro (เป็น paid แต่ tier PLUS) → จ่าย 30 ชี', async () => {
    h.membership = { isPaid: true, tier: 'PLUS' }
    const out = await call('GET', { id: 'f1' })
    expect((out.body as { plan: { basis: string } }).plan.basis).toBe('qi')
  })

  it('วันเกิดใช้คำนวณไม่ได้ → canCompute=false (ยังไม่คำนวณให้)', async () => {
    h.friendRow = friend({ dob: 'not-a-date' })
    const out = await call('GET', { id: 'f1' })
    expect((out.body as { canCompute: boolean }).canCompute).toBe(false)
  })
})

describe('POST /api/v2/friends/reading — คำนวณแล้วค่อยคิดเงิน', () => {
  it('Free/Plus: คำนวณสำเร็จ → หัก 30 ชีด้วยรหัส friend_reading + ref ของเพื่อน → ส่งดวงพร้อมยอดหลังหัก', async () => {
    const out = await call('POST', { body: { id: 'f1' } })
    expect(out.status).toBe(200)
    const body = out.body as { ok: boolean; charge: { basis: string; qi: number }; balance: number; reading: typeof ESSENCE; pillars: { day: { stem: string } }; freeSlots: unknown; friend: { name: string } }
    expect(body.ok).toBe(true)
    expect(body.charge).toEqual({ basis: 'qi', qi: 30 })
    expect(body.balance).toBe(7)
    expect(body.reading).toEqual(ESSENCE)
    expect(body.pillars.day.stem).toBe('癸')
    expect(body.freeSlots).toBeNull()
    expect(body.friend.name).toBe('สมศรี')
    const spend = engineCalls('/api/qi/spend')
    expect(spend.length).toBe(1)
    expect(spend[0].body).toEqual({ anonId: ME, code: 'friend_reading', ref: 'friend:f1' })
    // ลำดับ: คำนวณ (public-calc ไม่ผ่าน baziFetch · essence ผ่าน) มาก่อน spend
    const order = h.calls.map((c) => c.url).join(' ')
    expect(order.indexOf('/api/reading/reading-essence')).toBeLessThan(order.indexOf('/api/qi/spend'))
  })

  it('🔴 FR2 engine คำนวณล้ม (public-calc ล้ม) → 502 และไม่ยิง /api/qi/spend', async () => {
    h.calcOk = false
    const out = await call('POST', { body: { id: 'f1' } })
    expect(out.status).toBe(502)
    expect((out.body as { code?: string }).code).toBe('engine_unavailable')
    expect(engineCalls('/api/qi/spend')).toEqual([])
    expect(out.body).not.toHaveProperty('reading')
  })

  it('🔴 FR2 reading-essence ล้ม → 502 ไม่หักชีเช่นกัน (ไม่ขายชะตาอย่างเดียวในราคาเต็ม)', async () => {
    h.essenceOk = false
    const out = await call('POST', { body: { id: 'f1' } })
    expect(out.status).toBe(502)
    expect(engineCalls('/api/qi/spend')).toEqual([])
  })

  it('🔴 FR3 ชีไม่พอ (engine 409) → 402 พร้อมยอดจริง และไม่มีดวงติดมา', async () => {
    h.spendStatus = 409
    h.walletQi = 12
    const out = await call('POST', { body: { id: 'f1' } })
    expect(out.status).toBe(402)
    expect(out.body).toMatchObject({ code: 'insufficient_qi', priceQi: 30, balance: 12 })
    expect(out.body).not.toHaveProperty('reading')
    expect(out.body).not.toHaveProperty('chart')
  })

  it('spend ล้มด้วยอย่างอื่น (500) → 502 ไม่ส่งดวง', async () => {
    h.spendStatus = 500
    const out = await call('POST', { body: { id: 'f1' } })
    expect(out.status).toBe(502)
    expect(out.body).not.toHaveProperty('reading')
  })

  it('🔴 FR4 Pro คนที่ 4 (ยังมีสล็อต) → บันทึกสล็อต ไม่หักชี charge basis new_slot', async () => {
    h.membership = { isPaid: true, tier: 'PRO' }
    h.slots.ids = ['a', 'b', 'c']
    const out = await call('POST', { body: { id: 'f1' } })
    expect(out.status).toBe(200)
    expect((out.body as { charge: unknown }).charge).toEqual({ basis: 'new_slot', qi: 0 })
    expect((out.body as { freeSlots: unknown }).freeSlots).toEqual({ used: 4, max: 10 })
    expect(h.slots.taken).toEqual([{ userId: ME, friendId: 'f1' }])
    expect(engineCalls('/api/qi/spend')).toEqual([])
  })

  it('🔴 FR4 Pro คนที่ 11 → หัก 30 ชี ไม่บันทึกสล็อต', async () => {
    h.membership = { isPaid: true, tier: 'PRO' }
    h.slots.ids = Array.from({ length: 10 }, (_, i) => `s${i}`)
    const out = await call('POST', { body: { id: 'f1' } })
    expect(out.status).toBe(200)
    expect((out.body as { charge: unknown }).charge).toEqual({ basis: 'qi', qi: 30 })
    expect(h.slots.taken).toEqual([])
    expect(engineCalls('/api/qi/spend').length).toBe(1)
  })

  it('🔴 FR4 Pro ดูซ้ำคนที่อยู่ในสล็อตแล้ว → ฟรี ไม่เพิ่มสล็อต ไม่หักชี', async () => {
    h.membership = { isPaid: true, tier: 'PRO' }
    h.slots.ids = ['f1', 'a']
    const out = await call('POST', { body: { id: 'f1' } })
    expect((out.body as { charge: unknown }).charge).toEqual({ basis: 'slot', qi: 0 })
    expect(h.slots.taken).toEqual([])
    expect(engineCalls('/api/qi/spend')).toEqual([])
  })

  it('สล็อตเต็มระหว่างทาง (insert ไม่ได้) → ไปหัก 30 ชีแทน ไม่แถมฟรี', async () => {
    h.membership = { isPaid: true, tier: 'PRO' }
    h.slots.ids = ['a', 'b']
    h.slots.insertOk = false
    const out = await call('POST', { body: { id: 'f1' } })
    expect(out.status).toBe(200)
    expect((out.body as { charge: unknown }).charge).toEqual({ basis: 'qi', qi: 30 })
    expect(engineCalls('/api/qi/spend').length).toBe(1)
  })

  it('🔴 FR5 Pro + ตารางสล็อตล้นตอนบันทึก → 503 และไม่หักชี (ไม่เดวแอบหักสมาชิก Pro)', async () => {
    h.membership = { isPaid: true, tier: 'PRO' }
    h.slots.insertThrows = true
    const out = await call('POST', { body: { id: 'f1' } })
    expect(out.status).toBe(503)
    expect(engineCalls('/api/qi/spend')).toEqual([])
    expect(out.body).not.toHaveProperty('reading')
  })

  it('FR5 Free/Plus ไม่พึ่งตารางสล็อต: ตารางล้มก็ยังดูได้ (หักชีปกติ)', async () => {
    h.slots.down = true
    const out = await call('POST', { body: { id: 'f1' } })
    expect(out.status).toBe(200)
    expect(engineCalls('/api/qi/spend').length).toBe(1)
  })

  it('🔴 FR7 วันเกิดใช้คำนวณไม่ได้ → 422 ก่อนเรียก engine ใด ๆ', async () => {
    h.friendRow = friend({ dob: '15/06/2538' })
    const out = await call('POST', { body: { id: 'f1' } })
    expect(out.status).toBe(422)
    expect(engineCalls('/api/reading/reading-essence')).toEqual([])
    expect(engineCalls('/api/qi/spend')).toEqual([])
  })

  it('เพื่อนที่เป็นสมาชิก → อ่านวันเกิดจากตาราง user ของเพื่อน (ไม่ใช่ช่องว่างในแถวรายชื่อ)', async () => {
    h.friendRow = friend({ memberId: 'friend-account', dob: '', time: '', gender: null })
    h.userRow = { name: 'มานพ', dob: '1988-02-29', time: '', gender: 'MALE', placeName: '', isRememberTime: false, pictureUrl: 'https://x/m.png' }
    const out = await call('POST', { body: { id: 'f1' } })
    expect(out.status).toBe(200)
    const essence = engineCalls('/api/reading/reading-essence')[0]
    // is_remember_time=false → toBaziInput ใช้ 12:00 (ไม่แต่งเสาชั่วโมง) และเพศมาจากตาราง user
    expect(essence.body).toMatchObject({ birthDate: '1988-02-29', gender: 'male' })
    expect((out.body as { birth: { hasBirthTime: boolean } }).birth.hasBirthTime).toBe(false)
  })

  it('FR6 ไม่พบเพื่อน → 404 ไม่คำนวณ', async () => {
    h.friendRow = undefined
    const out = await call('POST', { body: { id: 'nope' } })
    expect(out.status).toBe(404)
    expect(engineCalls('/api/reading/reading-essence')).toEqual([])
  })

  it('POST ไม่มี id → 400 ก่อนเข้า DB', async () => {
    const out = await call('POST', { body: {} })
    expect(out.status).toBe(400)
    expect(h.wheres.length).toBe(0)
  })
})
