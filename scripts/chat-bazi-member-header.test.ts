// mumate-bdash-v2-001 slice 1 — the chat proxy names the member to bazi, so bazi's usage log and chat-topic
// rows (no message text) can be counted per person on bdash.
//
// 🔴 MUTANT CONTRACT:
//   M1  the header is dropped                             → "signed-in member" reddens
//   M2  the header is sent for an anonymous caller        → "anonymous caller" reddens
//   M3  the header takes the raw cookie instead of the resolved member → "resolved member" reddens
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({ member: '' }))

vi.mock('@/lib/v2/resolve-user', () => ({ resolveOptionalRouteMember: vi.fn(async () => h.member) }))
vi.mock('@/lib/db', () => ({ db: { execute: vi.fn(async () => []) } }))

const { default: handler } = await import('@/pages/api/chat/bazi')

type Sent = { url: string; headers: Record<string, string> }
let sent: Sent[] = []

const fetchMock = vi.fn(async (url: unknown, init?: { headers?: unknown }) => {
  const raw = init?.headers
  const headers = raw instanceof Headers ? Object.fromEntries(raw.entries()) : ((raw ?? {}) as Record<string, string>)
  sent.push({ url: String(url), headers })
  const u = String(url)
  if (u.endsWith('/api/qi/feature-check')) return new Response(JSON.stringify({ affordable: true }), { status: 200 })
  if (u.endsWith('/api/bazi/calculate')) return new Response(JSON.stringify({ calculatedState: { ok: 1 } }), { status: 200 })
  if (u.endsWith('/api/v1/chat/completions')) return new Response('data: {"choices":[{"delta":{"content":"สวัสดี"}}]}\n\n', { status: 200 })
  return new Response(JSON.stringify({ ok: true }), { status: 200 })
})

function call(cookies: Record<string, string> = {}) {
  const req = {
    method: 'POST',
    headers: { 'content-type': 'application/json', host: 'localhost' },
    cookies,
    body: {
      messages: [{ role: 'user', content: 'ปีนี้การเงินเป็นยังไง' }],
      birth: { dob: '1990-01-01', time: '08:00', gender: 'MALE', isRememberTime: true },
    },
  }
  const res = {
    status() { return res },
    json() { return res },
    writeHead() { return res },
    write() { return true },
    end() { return res },
    setHeader() { return res },
    getHeader() { return undefined },
  }
  return handler(req as never, res as never)
}

const completions = () => sent.find((s) => s.url.endsWith('/api/v1/chat/completions'))

beforeEach(() => {
  sent = []
  vi.stubGlobal('fetch', fetchMock)
  vi.stubEnv('OPEN_WEBUI_API_TOKEN', 't')
  vi.stubEnv('BAZI_BASE_URL', 'http://bazi')
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  h.member = ''
})

describe('POST /api/chat/bazi — member id for bazi usage', () => {
  it('signed-in member: the chat call carries x-openwebui-user-id', async () => {
    h.member = 'member-A'
    await call({ 'cookie-mumate-id': 'member-A' })
    expect(completions()?.headers['x-openwebui-user-id']).toBe('member-A')
  })

  it('resolved member: a cookie naming someone else never reaches the header', async () => {
    h.member = 'member-A'
    await call({ 'cookie-mumate-id': 'member-OTHER' })
    expect(JSON.stringify(sent)).not.toContain('member-OTHER')
  })

  it('anonymous caller: no header at all', async () => {
    await call()
    expect(completions()).toBeDefined()
    expect(completions()?.headers).not.toHaveProperty('x-openwebui-user-id')
  })
})
