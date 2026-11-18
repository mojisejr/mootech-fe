// mumate-chat-failed-answer-001 slice 1 — the chat route charges QI only for a real answer.
//
// 🔴 MUTANT CONTRACT:
//   M1  charge whenever bytes arrived (the old rule)      → "failure frame" and "no [DONE]" redden
//   M2  ignore the failure frame                          → "failure frame" reddens
//   M3  stop reading frames split across chunks           → "split frame" reddens
//   M4  never charge                                      → "real answer" reddens
//   M5  charge after the member's connection closed       → "member gone" reddens (slice 3)
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createAnswerOutcome } from '@/lib/chat/answer-outcome'

const h = vi.hoisted(() => ({ member: '', chunks: [] as string[] }))

vi.mock('@/lib/v2/resolve-user', () => ({ resolveOptionalRouteMember: vi.fn(async () => h.member) }))
vi.mock('@/lib/db', () => ({ db: { execute: vi.fn(async () => []) } }))

const { default: handler } = await import('@/pages/api/chat/bazi')

const frame = (o: unknown) => `data: ${JSON.stringify(o)}\n\n`
const role = frame({ object: 'chat.completion.chunk', choices: [{ index: 0, delta: { role: 'assistant' }, finish_reason: null }] })
const tok = (t: string) => frame({ object: 'chat.completion.chunk', choices: [{ index: 0, delta: { content: t }, finish_reason: null }] })
const stop = frame({ object: 'chat.completion.chunk', choices: [{ index: 0, delta: {}, finish_reason: 'stop' }] })
const failed = frame({ object: 'mumate.answer.failed', reason: 'timeout' })
const DONE = 'data: [DONE]\n\n'

let consumed = 0
let written = ''

const fetchMock = vi.fn(async (url: unknown) => {
  const u = String(url)
  if (u.endsWith('/api/qi/feature-check')) return new Response(JSON.stringify({ affordable: true }), { status: 200 })
  if (u.endsWith('/api/bazi/calculate')) return new Response(JSON.stringify({ calculatedState: { ok: 1 } }), { status: 200 })
  if (u.endsWith('/api/qi/feature-consume')) {
    consumed += 1
    return new Response(JSON.stringify({ ok: true }), { status: 200 })
  }
  if (u.endsWith('/api/v1/chat/completions')) {
    const enc = new TextEncoder()
    const chunks = h.chunks
    let i = 0
    return new Response(new ReadableStream({
      pull(c) {
        if (i < chunks.length) c.enqueue(enc.encode(chunks[i++]))
        else c.close()
      },
      cancel() { upstreamCancelled = true },
    }), { status: 200 })
  }
  return new Response(JSON.stringify({ ok: true }), { status: 200 })
})

let closeAfterWrites = 0
let upstreamCancelled = false

async function ask(chunks: string[]) {
  h.chunks = chunks
  const req = {
    method: 'POST',
    headers: { 'content-type': 'application/json', host: 'localhost' },
    cookies: { 'cookie-mumate-id': 'member-A' },
    body: {
      messages: [{ role: 'user', content: 'q' }],
      birth: { dob: '1990-01-01', time: '08:00', gender: 'MALE', isRememberTime: true },
    },
  }
  const listeners: Array<() => void> = []
  let writes = 0
  const res = {
    writableEnded: false,
    on(e: string, f: () => void) { if (e === 'close') listeners.push(f) },
    off() {},
    status() { return res },
    json() { return res },
    writeHead() { return res },
    write(t: string) {
      written += t
      writes += 1
      if (closeAfterWrites && writes === closeAfterWrites) for (const f of listeners) f()
      return true
    },
    end() { res.writableEnded = true; for (const f of listeners) f(); return res },
    setHeader() { return res },
    getHeader() { return undefined },
  }
  await handler(req as never, res as never)
}

beforeEach(() => {
  consumed = 0
  closeAfterWrites = 0
  upstreamCancelled = false
  written = ''
  h.member = 'member-A'
  vi.stubGlobal('fetch', fetchMock)
  vi.stubEnv('OPEN_WEBUI_API_TOKEN', 't')
  vi.stubEnv('BAZI_BASE_URL', 'http://bazi')
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('POST /api/chat/bazi — QI is charged only for a real answer', () => {
  it('real answer: charged once, stream passed through unchanged', async () => {
    const chunks = [role, tok('สวัสดี'), tok('ครับ'), stop, DONE]
    await ask(chunks)
    expect(consumed).toBe(1)
    expect(written).toBe(chunks.join(''))
  })

  it('failure frame: the fallback text reaches the member, no charge', async () => {
    const chunks = [role, failed, tok('ขออภัย ตอนนี้ยังตอบคำถามนี้ไม่ได้'), stop, DONE]
    await ask(chunks)
    expect(consumed).toBe(0)
    expect(written).toBe(chunks.join(''))
  })

  it('no [DONE]: a cut stream is not an answer', async () => {
    await ask([role, tok('สวัสดี')])
    expect(consumed).toBe(0)
  })

  it('no content: role and stop only', async () => {
    await ask([role, stop, DONE])
    expect(consumed).toBe(0)
  })

  it('split frame: a failure frame cut across chunks is still seen', async () => {
    const all = role + failed + tok('ขออภัย') + stop + DONE
    const cut = all.indexOf('mumate.answer') + 4
    await ask([all.slice(0, cut), all.slice(cut)])
    expect(consumed).toBe(0)
  })

  it('member gone: connection closed after the first frame is not charged and upstream is cancelled', async () => {
    closeAfterWrites = 1
    await ask([role, tok('สวัสดี'), tok('ครับ'), stop, DONE])
    expect(consumed).toBe(0)
    expect(upstreamCancelled).toBe(true)
    expect(written).toBe(role)
  })

  it('member gone just before [DONE]: still not charged', async () => {
    closeAfterWrites = 3
    await ask([role, tok('สวัสดี'), tok('ครับ'), stop, DONE])
    expect(consumed).toBe(0)
  })

  it('normal end: the close that follows end() does not cancel the charge', async () => {
    await ask([role, tok('สวัสดี'), stop, DONE])
    expect(consumed).toBe(1)
    expect(upstreamCancelled).toBe(false)
  })

  it('anonymous caller: never charged', async () => {
    h.member = ''
    await ask([role, tok('สวัสดี'), stop, DONE])
    expect(consumed).toBe(0)
  })
})

describe('createAnswerOutcome', () => {
  it('reads byte-by-byte chunking the same as one chunk', () => {
    const all = role + tok('ok') + stop + DONE
    const one = createAnswerOutcome()
    one.push(all)
    const many = createAnswerOutcome()
    for (const ch of all) many.push(ch)
    expect(many.finish()).toEqual(one.finish())
    expect(createAnswerOutcomeOf(all).answered).toBe(true)
  })

  it('a final frame without a trailing blank line still counts', () => {
    expect(createAnswerOutcomeOf(role + tok('ok') + 'data: [DONE]').answered).toBe(true)
  })
})

function createAnswerOutcomeOf(text: string) {
  const o = createAnswerOutcome()
  o.push(text)
  return o.finish()
}
