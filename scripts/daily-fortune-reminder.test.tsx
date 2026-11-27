// scripts/daily-fortune-reminder.test.ts — แจ้งเตือน "ดวงประจำวัน" (ประชุม 24 พ.ย. 2569 ข้อ 6)
//
// 🔴 MUTANT CONTRACT:
//   DF1 สิทธิ์: Plus/Pro ทุกวัน · ฟรี 7 วันจากวันสมัคร (วันที่ 8 ไม่ส่ง) · ตัดสินไม่ได้/หาวันสมัครไม่ได้ = ไม่ส่ง
//   DF2 cron: claim แบบ mark last_sent_date ก่อนส่ง (at-most-once ต่อวัน) · ไม่มี secret → 401 ไม่แตะ DB
//   DF3 cron ส่งเฉพาะคนที่ "มีสิทธิ์ + สวิตช์เปิด + มีอุปกรณ์" — ปิดสวิตช์/อ่านสวิตช์ไม่ได้ = ไม่ส่ง · gone → ลบ subscription
//   DF4 API ตั้งเวลา: เวลาไม่ถูก → 400 ไม่บันทึก · ไม่มี session → 401 · ไม่ล้าง last_sent_date
//   DF5 กดแจ้งเตือนตอนแอปเปิดอยู่ → ต้องพาไปหน้าที่แจ้งเตือนชี้ (ไม่ใช่แค่ focus หน้าเดิม) · navigate ไม่ได้ → focus
//   DF6 จอแจ้งเตือน: โชว์เวลาที่ตั้ง + "ทดลองฟรีอีก N วัน" + ทางอัปเกรดเมื่อหมดช่วง · เปลี่ยนเวลา → POST {time}
import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'
import { CookiesProvider } from 'react-cookie'

vi.mock('next/config', () => ({ default: () => ({ publicRuntimeConfig: {}, serverRuntimeConfig: {} }) }))
vi.mock('next/router', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), query: {}, pathname: '/v2/settings/notifications', isReady: true }),
}))
vi.mock('next-auth/react', () => ({ useSession: () => ({ data: null, status: 'unauthenticated' }) }))

type Access = { allowed: boolean; daysLeft: number | null; reason: 'member' | 'trial' | 'trial_over' | 'undetermined' }
const h = vi.hoisted(() => ({
  session: null as null | { userId: string },
  executes: [] as Array<{ text: string; values: unknown[] }>,
  claimed: [] as Array<{ userId: string }>,
  access: {} as Record<string, Access>,
  pref: {} as Record<string, boolean | null>,
  subs: {} as Record<string, Array<{ id: string; endpoint: string; p256dh: string; auth: string }>>,
  sendStatus: 'ok' as 'ok' | 'gone' | 'error',
  sent: [] as Array<{ endpoint: string; payload: { title: string; url: string } }>,
  deleted: [] as string[],
  time: { hour: 7, minute: 30 },
  upserts: [] as Array<{ userId: string; time: { hour: number; minute: number } }>,
  ensure: [] as string[],
}))

/** ข้อความ SQL + ค่าพารามิเตอร์จาก template ของ drizzle — ใช้อ่านว่า cron "claim" จริง
 *  โครงสร้าง drizzle 0.45: queryChunks เป็น array ปนกัน — StringChunk (ข้อความของคำสั่ง) กับ "ค่าดิบ" (พารามิเตอร์) */
function sqlOf(q: { queryChunks?: unknown } | null | undefined): { text: string; values: unknown[] } {
  let text = ''
  const values: unknown[] = []
  const walk = (node: unknown, inChunk: boolean): void => {
    if (node === null || node === undefined) return
    if (typeof node === 'string') {
      if (inChunk) text += node
      else { values.push(node); text += '?' }
      return
    }
    if (typeof node !== 'object') { values.push(node); text += '?'; return }
    if (Array.isArray(node)) return node.forEach((n) => walk(n, inChunk))
    const ctor = (node as object).constructor?.name
    if (ctor === 'Param') { values.push((node as { value: unknown }).value); text += '?'; return }
    if (ctor === 'StringChunk') return walk((node as { value: unknown[] }).value, true)
    if ('queryChunks' in node) return walk((node as { queryChunks: unknown }).queryChunks, false)
    if (typeof (node as { name?: unknown }).name === 'string' && (node as { table?: unknown }).table) { text += (node as { name: string }).name; return }
  }
  walk(q?.queryChunks, false)
  return { text, values }
}

vi.mock('@/lib/db', () => ({
  db: {
    execute: vi.fn(async (q: unknown) => {
      const { text, values } = sqlOf(q as { queryChunks?: unknown })
      h.executes.push({ text, values })
      return text.includes('UPDATE daily_fortune_reminder') ? h.claimed : []
    }),
  },
}))

vi.mock('@/lib/v2/daily-fortune-reminder', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/v2/daily-fortune-reminder')>()
  return {
    ...actual,
    resolveDailyReminderAccess: vi.fn(async (userId: string) => h.access[userId] ?? { allowed: false, daysLeft: null, reason: 'undetermined' }),
    dailyFortunePrefOn: vi.fn(async (userId: string) => (userId in h.pref ? h.pref[userId] : true)),
    readDailyFortuneReminder: vi.fn(async () => h.time),
    upsertDailyFortuneReminder: vi.fn(async (userId: string, time: { hour: number; minute: number }) => { h.upserts.push({ userId, time }) }),
    ensureDailyFortuneReminderRow: vi.fn(async (userId: string) => { h.ensure.push(userId) }),
  }
})
vi.mock('@/lib/push/repo', () => ({
  createDbRepo: () => ({
    loadSubscriptions: async (userId: string) => h.subs[userId] ?? [],
    deleteSubscription: async (id: string) => { h.deleted.push(id) },
  }),
}))
vi.mock('@/lib/push/send', () => ({
  sendPush: async (target: { endpoint: string }, payload: { title: string; url: string }) => {
    h.sent.push({ endpoint: target.endpoint, payload })
    return { status: h.sendStatus }
  },
}))
vi.mock('@/lib/v2/resolve-user', () => ({
  resolveRouteMember: async () => (h.session ? { ok: true, userId: h.session.userId } : { ok: false, status: 401, body: { code: 'not_authenticated', error: 'not signed in' } }),
}))

import cronHandler from '@/pages/api/cron/daily-fortune'
import apiHandler from '@/pages/api/v2/daily-fortune-reminder'
import { dailyReminderAccess, parseSignupDate, bkkDateOf, dailyReminderAccessNote, FREE_DAILY_REMINDER_DAYS } from '@/lib/v2/daily-fortune-access'
import { buildDailyFortunePayload } from '@/lib/push/payload'
import { focusOrOpenUrl, type WindowClientLike } from '@/lib/push/notification-click'
import { parseDailyReminderTime, normalizeDailyReminderTime } from '@/lib/v2/daily-fortune-reminder'
import { NotificationsScreen, dailyFortuneSubText } from '@/features/v2-settings/components/NotificationsScreen'

const SECRET = 'cron-secret-for-test'
const ME = '11111111-1111-4111-8111-111111111111'
const SUB = { id: 'sub-1', endpoint: 'https://push.example/x', p256dh: 'p', auth: 'a' }
const bkk = (y: number, mo: number, d: number, hh = 12, mi = 0) => new Date(Date.UTC(y, mo - 1, d, hh - 7, mi))
const MEMBER: Access = { allowed: true, daysLeft: null, reason: 'member' }

async function callCron(headers: Record<string, string> = {}) {
  const out = { status: 200, body: undefined as unknown }
  const res: Record<string, unknown> = {
    statusCode: 200,
    status(c: number) { out.status = c; return res },
    json(b: unknown) { out.body = b; return res },
  }
  await cronHandler({ method: 'GET', headers, query: {}, cookies: {} } as never, res as never)
  return out
}
async function callApi(method: 'GET' | 'POST', body: unknown = {}) {
  const out = { status: 200, body: undefined as unknown }
  const res: Record<string, unknown> = {
    statusCode: 200,
    status(c: number) { out.status = c; return res },
    json(b: unknown) { out.body = b; return res },
  }
  await apiHandler({ method, body, cookies: {}, headers: {}, query: {} } as never, res as never)
  return out
}

beforeEach(() => {
  process.env.CRON_SECRET = SECRET
  h.session = { userId: ME }
  h.executes.length = 0
  h.claimed = []
  h.access = { u1: MEMBER }
  h.pref = {}
  h.subs = { u1: [SUB] }
  h.sendStatus = 'ok'
  h.sent.length = 0
  h.deleted.length = 0
  h.time = { hour: 7, minute: 30 }
  h.upserts.length = 0
  h.ensure.length = 0
})
afterEach(() => { cleanup(); delete process.env.CRON_SECRET })

describe('DF1 กติกาสิทธิ์ (pure)', () => {
  it('สมาชิก (isPaid true) → อนุญาตทุกวัน ไม่นับวัน', () => {
    expect(FREE_DAILY_REMINDER_DAYS).toBe(7)
    expect(dailyReminderAccess({ isPaid: true, signupAt: null, now: bkk(2026, 1, 1) })).toEqual(MEMBER)
    expect(dailyReminderAccess({ isPaid: true, signupAt: bkk(2020, 1, 1), now: bkk(2026, 1, 1) })).toEqual(MEMBER)
  })

  it('🔴 ฟรี: วันสมัครเหลือ 7 → วันที่ 7 เหลือ 1 → วันที่ 8 ไม่ส่ง', () => {
    const now = bkk(2026, 11, 30)
    expect(dailyReminderAccess({ isPaid: false, signupAt: bkk(2026, 11, 30), now })).toEqual({ allowed: true, daysLeft: 7, reason: 'trial' })
    expect(dailyReminderAccess({ isPaid: false, signupAt: bkk(2026, 11, 24), now })).toEqual({ allowed: true, daysLeft: 1, reason: 'trial' })
    expect(dailyReminderAccess({ isPaid: false, signupAt: bkk(2026, 11, 23), now })).toEqual({ allowed: false, daysLeft: 0, reason: 'trial_over' })
  })

  it('ขอบเขตเวลาไทย: สมัคร 23:30 น. วันที่ 1 → เที่ยงคืนวันที่ 2 นับเป็นวันที่ 2 แล้ว (เหลือ 6)', () => {
    const signup = bkk(2026, 11, 1, 23, 30)
    expect(bkkDateOf(signup)).toBe('2026-11-01')
    expect(dailyReminderAccess({ isPaid: false, signupAt: signup, now: bkk(2026, 11, 2, 0, 5) })).toEqual({ allowed: true, daysLeft: 6, reason: 'trial' })
  })

  it('🔴 ตัดสินไม่ได้ (isPaid null) / หาวันสมัครไม่ได้ → ไม่ส่ง', () => {
    expect(dailyReminderAccess({ isPaid: null, signupAt: bkk(2026, 11, 30), now: bkk(2026, 11, 30) })).toMatchObject({ allowed: false, reason: 'undetermined' })
    expect(dailyReminderAccess({ isPaid: false, signupAt: null, now: bkk(2026, 11, 30) })).toMatchObject({ allowed: false, reason: 'undetermined' })
  })

  it('parseSignupDate: create_at แบบเวลาไทย · ISO · ค่าเพี้ยน → null (ไม่เดา)', () => {
    expect(bkkDateOf(parseSignupDate('2026-11-24 09:05:00') as Date)).toBe('2026-11-24')
    expect(bkkDateOf(parseSignupDate('2026-11-24') as Date)).toBe('2026-11-24')
    expect(bkkDateOf(parseSignupDate('', '2026-11-23T18:30:00.000Z') as Date)).toBe('2026-11-24')
    expect(parseSignupDate('2026-13-45 00:00:00')).toBeNull()
    expect(parseSignupDate(null, null)).toBeNull()
    expect(parseSignupDate('not-a-date', 'nope')).toBeNull()
  })

  it('ข้อความบอกสิทธิ์: ช่วงทดลอง → "ทดลองฟรีอีก N วัน" · หมดช่วง → บอกว่าหมด · สมาชิก → ว่าง', () => {
    expect(dailyReminderAccessNote({ allowed: true, daysLeft: 5, reason: 'trial' })).toBe(' · ทดลองฟรีอีก 5 วัน')
    expect(dailyReminderAccessNote({ allowed: false, daysLeft: 0, reason: 'trial_over' })).toBe(' · หมดช่วงทดลองฟรีแล้ว')
    expect(dailyReminderAccessNote(MEMBER)).toBe('')
    expect(dailyReminderAccessNote(null)).toBe('')
  })
})

describe('DF2/DF3 cron /api/cron/daily-fortune', () => {
  it('🔴 ไม่มี secret → 401 ไม่แตะ DB', async () => {
    const out = await callCron({})
    expect(out.status).toBe(401)
    expect(h.executes).toEqual([])
    const wrong = await callCron({ authorization: 'Bearer nope' })
    expect(wrong.status).toBe(401)
  })

  it('🔴 claim = mark last_sent_date ก่อนส่ง และคืนเฉพาะแถวที่ตรงเวลา + ยังไม่ส่งวันนี้ (ที่มาของ at-most-once)', async () => {
    await callCron({ authorization: `Bearer ${SECRET}` })
    const claim = h.executes.find((e) => e.text.includes('UPDATE daily_fortune_reminder'))
    // drizzle ใส่ค่า string แบบ inlined ส่วนตัวเลขเป็น placeholder — ยอมรับได้ทั้ง "?" และค่าจริง ขอแค่โครงคำสั่งถูก
    const t = (claim?.text ?? '').replace(/\s+/g, ' ')
    expect(t).toMatch(/UPDATE daily_fortune_reminder SET last_sent_date = (\?|\S+)/)
    expect(t).toMatch(/WHERE hour = (\?|\d+)/)
    expect(t).toMatch(/AND minute = (\?|\d+)/)
    expect(t).toMatch(/last_sent_date IS NULL OR last_sent_date <> (\?|\S+)/)
    expect(t).toContain('RETURNING user_id')
  })

  it('ส่งให้คนที่มีสิทธิ์ + สวิตช์เปิด + มีอุปกรณ์ ด้วย payload ดวงประจำวัน → deep-link /v2', async () => {
    h.claimed = [{ userId: 'u1' }]
    const out = await callCron({ authorization: `Bearer ${SECRET}` })
    expect(out.status).toBe(200)
    expect(out.body).toMatchObject({ ok: true, claimed: 1, sent: 1, notEntitled: 0, optedOut: 0, noDevice: 0 })
    expect(h.sent.length).toBe(1)
    expect(h.sent[0].endpoint).toBe(SUB.endpoint)
    expect(h.sent[0].payload.url).toBe('/v2')
  })

  it('🔴 ไม่มีสิทธิ์ (หมดช่วงฟรี) → ไม่ส่ง นับเป็น notEntitled · ปิดสวิตช์ → ไม่ส่ง · อ่านสวิตช์ไม่ได้ → ไม่ส่ง', async () => {
    h.claimed = [{ userId: 'over' }, { userId: 'off' }, { userId: 'unknown' }]
    h.access = { over: { allowed: false, daysLeft: 0, reason: 'trial_over' }, off: MEMBER, unknown: MEMBER }
    h.pref = { off: false, unknown: null }
    h.subs = { over: [SUB], off: [SUB], unknown: [SUB] }
    const out = await callCron({ authorization: `Bearer ${SECRET}` })
    expect(out.body).toMatchObject({ claimed: 3, sent: 0, notEntitled: 1, optedOut: 1, unknown: 1 })
    expect(h.sent).toEqual([])
  })

  it('ไม่มีอุปกรณ์ (ไม่มี subscription) → noDevice · subscription ตาย (gone) → ลบทิ้ง', async () => {
    h.claimed = [{ userId: 'nodev' }, { userId: 'gone' }]
    h.access = { nodev: MEMBER, gone: MEMBER }
    h.subs = { gone: [{ ...SUB, id: 'dead' }] }
    h.sendStatus = 'gone'
    const out = await callCron({ authorization: `Bearer ${SECRET}` })
    expect(out.body).toMatchObject({ noDevice: 1, sent: 0, deletedSubscriptions: 1 })
    expect(h.deleted).toEqual(['dead'])
  })

  it('method อื่น (POST) → 405', async () => {
    const out = { status: 0 }
    const res: Record<string, unknown> = { status(c: number) { out.status = c; return res }, json() { return res } }
    await cronHandler({ method: 'POST', headers: { authorization: `Bearer ${SECRET}` }, query: {}, cookies: {} } as never, res as never)
    expect(out.status).toBe(405)
  })
})

describe('DF4 API /api/v2/daily-fortune-reminder', () => {
  it('GET → เวลาที่ตั้ง + สิทธิ์ของผู้ใช้', async () => {
    h.access = { [ME]: { allowed: true, daysLeft: 4, reason: 'trial' } }
    const out = await callApi('GET')
    expect(out.status).toBe(200)
    expect(out.body).toEqual({ ok: true, hour: 7, minute: 30, access: { allowed: true, daysLeft: 4, reason: 'trial' } })
    expect(h.upserts).toEqual([])
  })

  it('POST {time} → บันทึกเวลา 1 ครั้ง และไม่ยิง SQL ล้าง last_sent_date', async () => {
    const out = await callApi('POST', { time: '08:30' })
    expect(out.status).toBe(200)
    expect(h.upserts).toEqual([{ userId: ME, time: { hour: 8, minute: 30 } }])
    expect(h.executes.some((e) => e.text.includes('last_sent_date'))).toBe(false)
  })

  it('🔴 เวลาไม่ถูก → 400 และไม่บันทึก', async () => {
    for (const body of [{ time: '25:00' }, { time: '7' }, { time: 'ab:cd' }, { hour: 24 }, {}, { hour: 7, minute: 60 }]) {
      expect((await callApi('POST', body)).status, JSON.stringify(body)).toBe(400)
    }
    expect(h.upserts).toEqual([])
  })

  it('POST {hour, minute} ตรง ๆ ก็ได้', async () => {
    expect((await callApi('POST', { hour: 6, minute: 0 })).status).toBe(200)
    expect(h.upserts[0]?.time).toEqual({ hour: 6, minute: 0 })
  })

  it('ไม่มี session → 401 ไม่อ่าน/ไม่บันทึกอะไร', async () => {
    h.session = null
    expect((await callApi('GET')).status).toBe(401)
    expect((await callApi('POST', { time: '08:00' })).status).toBe(401)
    expect(h.upserts).toEqual([])
  })

  it('parseDailyReminderTime / normalizeDailyReminderTime (pure)', () => {
    expect(parseDailyReminderTime('07:30')).toEqual({ hour: 7, minute: 30 })
    expect(parseDailyReminderTime(' 7:05 ')).toEqual({ hour: 7, minute: 5 })
    expect(parseDailyReminderTime('24:00')).toBeNull()
    expect(parseDailyReminderTime(730)).toBeNull()
    expect(normalizeDailyReminderTime({ hour: 23, minute: 59 })).toEqual({ hour: 23, minute: 59 })
    expect(normalizeDailyReminderTime({ hour: -1, minute: 0 })).toBeNull()
    expect(normalizeDailyReminderTime(null)).toBeNull()
  })
})

describe('payload + sw notificationclick', () => {
  it('payload ดวงประจำวัน: ไม่ส่งเนื้อหาดวงใน push · deep-link หน้าหลัก', () => {
    const p = buildDailyFortunePayload()
    expect(p.url).toBe('/v2')
    expect(p.title).toContain('ดวงวันนี้')
    expect(p.body).not.toMatch(/ธาตุ|ดาว|เกณฑ์/) // ข้อความทั่วไป ไม่ใช่เนื้อหาดวง
  })

  const client = (url: string, navigateOk = true) => {
    const calls: string[] = []
    const c: WindowClientLike & { calls: string[] } = {
      url,
      calls,
      focus: async () => { calls.push('focus') },
      navigate: async (u: string) => { calls.push(`navigate:${u}`); if (!navigateOk) throw new Error('not allowed') },
    }
    return c
  }

  it('🔴 DF5 มีหน้าต่างโดเมนเดียวกันอยู่แล้ว → navigate ไป url แล้ว focus (ไม่ใช่แค่ focus หน้าเดิม)', async () => {
    const mine = client('https://app.example/v2/settings')
    const out = await focusOrOpenUrl([client('https://other.example/'), mine], '/v2', 'https://app.example')
    expect(out).toBe(mine)
    expect(mine.calls).toEqual(['navigate:/v2', 'focus'])
  })

  it('มีแต่หน้าต่างโดเมนอื่น → พยายาม navigate แล้ว focus อย่างน้อย', async () => {
    const other = client('https://other.example/', false)
    const out = await focusOrOpenUrl([other], '/v2', 'https://app.example')
    expect(out).toBe(other)
    expect(other.calls).toEqual(['navigate:/v2', 'focus'])
  })

  it('ไม่มีหน้าต่างเลย → null (ให้ผู้เรียก openWindow)', async () => {
    expect(await focusOrOpenUrl([], '/v2', 'https://app.example')).toBeNull()
  })

  it('sw.ts ใช้ helper ตัวนี้จริง (ไม่ใช่ logic เก่าที่ focus หน้าเดิม)', () => {
    const sw = readFileSync(join(process.cwd(), 'sw.ts'), 'utf8')
    expect(sw).toMatch(/focusOrOpenUrl\(windows, url, self\.location\.origin\)/)
    expect(sw).toMatch(/self\.clients\.openWindow\(url\)/)
    expect(sw).not.toMatch(/return \(existing as WindowClient\)\.focus\(\)/)
  })

  it('vercel.json ลงทะเบียน cron + maxDuration', () => {
    const v = JSON.parse(readFileSync(join(process.cwd(), 'vercel.json'), 'utf8')) as { crons: { path: string }[]; functions: Record<string, unknown> }
    expect(v.crons.map((c) => c.path)).toContain('/api/cron/daily-fortune')
    expect(v.functions['pages/api/cron/daily-fortune.ts']).toEqual({ maxDuration: 60 })
  })
})

describe('DF6 จอแจ้งเตือน — แถว "ดวงประจำวัน"', () => {
  const stub = (daily: unknown) => {
    vi.stubGlobal('Notification', { permission: 'default' })
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: { method?: string; body?: string }) => {
      const u = String(url)
      const json = async () => (u.includes('/api/notification-prefs') ? { dailyFortune: true, reminders: true, updates: false }
        : u.includes('/api/v2/daily-fortune-reminder') && (init?.method ?? 'GET') === 'POST' ? { ok: true, ...(parseDailyReminderTime(JSON.parse(String(init?.body)).time) ?? {}), access: daily.access }
        : u.includes('/api/v2/daily-fortune-reminder') ? { ok: true, hour: daily.hour, minute: daily.minute, access: daily.access }
        : { ok: true })
      return { ok: true, status: 200, json }
    }))
  }
  afterEach(() => vi.unstubAllGlobals())

  it('dailyFortuneSubText: เวลาที่ตั้ง + สิทธิ์ · ยังไม่โหลด → ข้อความเริ่มต้น', () => {
    expect(dailyFortuneSubText({ hour: 7, minute: 30 }, { allowed: true, daysLeft: 5, reason: 'trial' })).toBe('ส่งทุกเช้าเวลา 07:30 น. · ทดลองฟรีอีก 5 วัน')
    expect(dailyFortuneSubText(null, null)).toBe('ส่งทุกเช้าเวลา 07:00 น.')
  })

  it('🔴 ผู้ใช้ฟรีหมดช่วง → โชว์ว่าหมดช่วง + ทางอัปเกรดไปร้าน · เปลี่ยนเวลา → POST {time}', async () => {
    stub({ hour: 7, minute: 0, access: { allowed: false, daysLeft: 0, reason: 'trial_over' } })
    render(<CookiesProvider><NotificationsScreen /></CookiesProvider>)
    const sub = await waitFor(() => screen.getByTestId('notif-daily-sub'))
    expect(sub.textContent).toBe('ส่งทุกเช้าเวลา 07:00 น. · หมดช่วงทดลองฟรีแล้ว')
    expect(screen.getByTestId('notif-daily-upgrade').getAttribute('href')).toBe('/v2/shop')
    const select = screen.getByTestId('notif-daily-time') as HTMLSelectElement
    fireEvent.change(select, { target: { value: '08:30' } })
    await waitFor(() => expect(screen.getByTestId('notif-daily-sub').textContent).toContain('08:30'))
    const posts = (fetch as unknown as { mock: { calls: unknown[][] } }).mock.calls.filter((c) => (c[1] as { method?: string } | undefined)?.method === 'POST' && String(c[0]).includes('daily-fortune-reminder'))
    expect(posts.length).toBe(1)
    expect(JSON.parse(String(posts[0][1]?.body))).toEqual({ time: '08:30' })
  })

  it('ผู้ใช้ฟรีในช่วง → "ทดลองฟรีอีก N วัน" ไม่มีทางอัปเกรด', async () => {
    stub({ hour: 9, minute: 30, access: { allowed: true, daysLeft: 3, reason: 'trial' } })
    render(<CookiesProvider><NotificationsScreen /></CookiesProvider>)
    await waitFor(() => expect(screen.getByTestId('notif-daily-sub').textContent).toBe('ส่งทุกเช้าเวลา 09:30 น. · ทดลองฟรีอีก 3 วัน'))
    expect((screen.getByTestId('notif-daily-time') as HTMLSelectElement).value).toBe('09:30')
    expect(screen.queryByTestId('notif-daily-upgrade')).toBeNull()
  })

  it('โหลดเวลาไม่ได้ → จอยังใช้ได้ ใช้ข้อความเริ่มต้น', async () => {
    vi.stubGlobal('Notification', { permission: 'default' })
    vi.stubGlobal('fetch', vi.fn(async (url: string) => ({
      ok: !String(url).includes('daily-fortune'), status: String(url).includes('daily-fortune') ? 500 : 200,
      json: async () => (String(url).includes('/api/notification-prefs') ? { dailyFortune: true } : { error: 'x' }),
    })))
    render(<CookiesProvider><NotificationsScreen /></CookiesProvider>)
    await waitFor(() => expect(screen.getByTestId('notif-daily-sub').textContent).toBe('ส่งทุกเช้าเวลา 07:00 น.'))
    expect(screen.getByTestId('notif-master')).toBeTruthy()
  })
})
