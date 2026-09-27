// @vitest-environment node
// (node, not jsdom: the route parses multipart with Node's own Response.formData(), and the spec builds its
//  bodies with Node's FormData/Blob — jsdom's versions are not the ones the server runs.)
//
// CIEL mumate-be-retirement-001 slice 1f — POST /api/object-storage/upload-file stores a friend photo in
// Supabase Storage and answers { s3_key: <public URL> }, the shape v2 AddFriendSheet reads.
// Parity and the deliberate differences from mootech-be: lib/storage/friend-photo.ts.
//
// Bug-class this owns: a public-bucket write reachable without a caller, or with anything that is not a
// small image. The BE route had no identity check, accepted any type up to 50 MB, and answered with a URL
// even when the upload had failed.
//
// 🔴 MUTANT CONTRACT — fired 2026-09-27, results as observed:
//   MU1  drop the session gate                          → ② reddens (storage is reached)
//   MU3  drop the magic-byte check                      → ④ reddens
//   MU4  drop the streamed cap (trust Content-Length)   → ⑤ reddens (case b: a small file padded by a big field)
//   MU6  send x-upsert: true                            → ① reddens
//   MU2  drop the type allowlist ALONE                  → NOTHING REDDENS, and that is the design, not a gap:
//        bytesMatchType only knows the three allowed types, so any other type fails the magic check with the
//        same 415. The two checks are layers; ③ reddens when both are dropped. Written down so nobody reads
//        ③ as proof of the allowlist on its own.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Readable } from 'node:stream'

const h = vi.hoisted(() => ({
  who: { ok: true, userId: 'CALLER-A' } as { ok: true; userId: string } | { ok: false; status: 401; error: string },
}))
vi.mock('@/lib/v2/resolve-user', () => ({ resolveSessionUserId: vi.fn(async () => h.who) }))

import handler, { config } from '../pages/api/object-storage/upload-file'
import { FRIEND_PHOTO_MAX_BYTES, friendPhotoKey } from '@/lib/storage/friend-photo'

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1])
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d])
const WEBP = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x24, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50])

async function multipart(bytes: Uint8Array, type: string, field = 'file') {
  const fd = new FormData()
  fd.append(field, new Blob([bytes], { type }), 'photo')
  const r = new Request('http://local/upload', { method: 'POST', body: fd })
  return { body: Buffer.from(await r.arrayBuffer()), contentType: r.headers.get('content-type') as string }
}

function makeReq(body: Buffer, headers: Record<string, string>, method = 'POST') {
  const stream = Readable.from([body]) as unknown as Record<string, unknown>
  stream.method = method
  stream.headers = headers
  stream.cookies = {}
  stream.query = {}
  return stream as never
}

async function send(bytes: Uint8Array, type: string, extraHeaders: Record<string, string> = {}) {
  const mp = await multipart(bytes, type)
  const res = makeRes()
  await handler(makeReq(mp.body, { 'content-type': mp.contentType, 'content-length': String(mp.body.length), ...extraHeaders }), res as never)
  return res
}

function makeRes() {
  const res: { statusCode: number; body: any; status: any; json: any; setHeader: any } = {
    statusCode: 0,
    body: undefined,
    status: vi.fn((c: number) => ((res.statusCode = c), res)),
    json: vi.fn((b: unknown) => ((res.body = b), res)),
    setHeader: vi.fn(),
  }
  return res
}

const KEY = 'sb_secret_TEST-ONLY-not-a-real-key'
const ENV = {
  SUPABASE_PROJECT_URL: 'https://proj.supabase.invalid/',
  SUPABASE_SERVICE_ROLE_KEY: KEY,
  SUPABASE_STORAGE_BUCKET: 'mootech',
}

describe('POST /api/object-storage/upload-file — friend photo → Supabase Storage', () => {
  const saved: Record<string, string | undefined> = {}
  let storage: ReturnType<typeof vi.fn>

  beforeEach(() => {
    h.who = { ok: true, userId: 'CALLER-A' }
    for (const [k, v] of Object.entries(ENV)) {
      saved[k] = process.env[k]
      process.env[k] = v
    }
    storage = vi.fn(async () => new Response(JSON.stringify({ Key: 'x' }), { status: 200 }))
    vi.stubGlobal('fetch', storage)
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    for (const k of Object.keys(ENV)) {
      if (saved[k] === undefined) delete process.env[k]
      else process.env[k] = saved[k]
    }
  })

  it('the route reads its own body (Next\'s body parser is off)', () => {
    expect(config).toEqual({ api: { bodyParser: false } })
  })

  it('🔴 ① a signed-in JPEG upload: one storage POST (service key, no upsert), answer { s3_key: public URL }', async () => {
    const res = await send(JPEG, 'image/jpeg')
    expect(res.statusCode).toBe(200)
    expect(storage).toHaveBeenCalledTimes(1)
    const [url, init] = storage.mock.calls[0] as unknown as [string, RequestInit]
    const m = /^https:\/\/proj\.supabase\.invalid\/storage\/v1\/object\/mootech\/(mumate\/profile\/\d{14}_[0-9a-f]{12}\.jpg)$/.exec(url)
    expect(m, url).not.toBeNull()
    const headers = init.headers as Record<string, string>
    expect(headers.Authorization).toBe(`Bearer ${KEY}`)
    expect(headers.apikey).toBe(KEY)
    expect(headers['Content-Type']).toBe('image/jpeg')
    expect(headers['x-upsert']).toBe('false')
    expect(Buffer.from(init.body as Uint8Array)).toEqual(Buffer.from(JPEG))
    // the answer the sheet reads — the PUBLIC url of the same key, and never the key material
    expect(res.body).toEqual({ s3_key: `https://proj.supabase.invalid/storage/v1/object/public/mootech/${m![1]}` })
    expect(JSON.stringify(res.body)).not.toContain(KEY)
  })

  it('① b PNG and WEBP are accepted with their own extensions', async () => {
    expect((await send(PNG, 'image/png')).statusCode).toBe(200)
    expect((await send(WEBP, 'image/webp')).statusCode).toBe(200)
    expect((storage.mock.calls[0] as unknown as [string])[0]).toMatch(/\.png$/)
    expect((storage.mock.calls[1] as unknown as [string])[0]).toMatch(/\.webp$/)
  })

  it('🔴 ② no session → 401 and storage is never reached (the BE route had no caller check at all)', async () => {
    h.who = { ok: false, status: 401, error: 'not signed in' }
    const res = await send(JPEG, 'image/jpeg')
    expect(res.statusCode).toBe(401)
    expect(storage).not.toHaveBeenCalled()
  })

  it('🔴 ③ a type outside jpeg/png/webp → 415 (the BE stored any type into the public bucket)', async () => {
    for (const [bytes, type] of [
      [new TextEncoder().encode('<html><script>alert(1)</script></html>'), 'text/html'],
      [new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]), 'image/gif'],
      [new TextEncoder().encode('<svg/>'), 'image/svg+xml'],
      [JPEG, 'application/octet-stream'],
    ] as Array<[Uint8Array, string]>) {
      const res = await send(bytes, type)
      expect(res.statusCode, type).toBe(415)
    }
    expect(storage).not.toHaveBeenCalled()
  })

  it('🔴 ④ a declared image whose bytes are not that image → 415', async () => {
    const res = await send(new TextEncoder().encode('<html>not a jpeg</html>'), 'image/jpeg')
    expect(res.statusCode).toBe(415)
    const res2 = await send(JPEG, 'image/png') // a real JPEG labelled PNG
    expect(res2.statusCode).toBe(415)
    expect(storage).not.toHaveBeenCalled()
  })

  it('🔴 ⑤ over 4 MB → 413: by Content-Length before reading, and by the stream when the header lies', async () => {
    const big = new Uint8Array(FRIEND_PHOTO_MAX_BYTES + 1)
    big.set(JPEG)
    const honest = await send(big, 'image/jpeg')
    expect(honest.statusCode).toBe(413)
    // b — the header claims a small body; the stream carries a big one. The FILE is small and valid — the bulk
    //     is a second field — so only the streamed cap can refuse it (the per-file size check would pass).
    const fd = new FormData()
    fd.append('file', new Blob([JPEG], { type: 'image/jpeg' }), 'photo')
    fd.append('pad', 'x'.repeat(FRIEND_PHOTO_MAX_BYTES + 128 * 1024))
    const r = new Request('http://local/upload', { method: 'POST', body: fd })
    const padded = Buffer.from(await r.arrayBuffer())
    const liar = makeRes()
    await handler(makeReq(padded, { 'content-type': r.headers.get('content-type') as string, 'content-length': '100' }), liar as never)
    expect(liar.statusCode).toBe(413)
    // c — no Content-Length at all.
    const mp = await multipart(big, 'image/jpeg')
    const res = makeRes()
    await handler(makeReq(mp.body, { 'content-type': mp.contentType }), res as never)
    expect(res.statusCode).toBe(413)
    expect(storage).not.toHaveBeenCalled()
  })

  it('⑥ empty file, missing `file` part, or a non-multipart body → 400 / 415, nothing stored', async () => {
    expect((await send(new Uint8Array(0), 'image/jpeg')).statusCode).toBe(400)
    const wrongField = await multipart(JPEG, 'image/jpeg', 'photo')
    const r1 = makeRes()
    await handler(makeReq(wrongField.body, { 'content-type': wrongField.contentType }), r1 as never)
    expect(r1.statusCode).toBe(400)
    const r2 = makeRes()
    await handler(makeReq(Buffer.from('{"file":"x"}'), { 'content-type': 'application/json' }), r2 as never)
    expect(r2.statusCode).toBe(415)
    expect(storage).not.toHaveBeenCalled()
  })

  it('🔴 ⑦ storage refuses → 502, no URL handed back (the BE answered with the URL of a file never written)', async () => {
    storage.mockResolvedValueOnce(new Response('{"error":"Duplicate"}', { status: 409 }))
    const res = await send(JPEG, 'image/jpeg')
    expect(res.statusCode).toBe(502)
    expect(res.body).toEqual({ error: 'upload failed' })
    storage.mockRejectedValueOnce(new Error('ECONNREFUSED'))
    expect((await send(JPEG, 'image/jpeg')).statusCode).toBe(502)
  })

  it('⑧ storage not configured → 503 before the body is read; nothing is sent anywhere', async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY
    const res = await send(JPEG, 'image/jpeg')
    expect(res.statusCode).toBe(503)
    expect(storage).not.toHaveBeenCalled()
  })

  it('⑨ the bucket defaults to the BE\'s default (\'mootech\') when unset', async () => {
    delete process.env.SUPABASE_STORAGE_BUCKET
    await send(JPEG, 'image/jpeg')
    expect((storage.mock.calls[0] as unknown as [string])[0]).toContain('/storage/v1/object/mootech/')
  })

  it('⑩ key shape: mumate/profile/<Bangkok YYYYMMDDHHmmss>_<12 hex>.<ext> (BE prefix and clock)', () => {
    expect(friendPhotoKey('image/jpeg', new Date('2026-09-27T17:30:05Z'), 'abcdef012345')).toBe(
      'mumate/profile/20260928003005_abcdef012345.jpg',
    )
  })

  it('⑪ only POST', async () => {
    const res = makeRes()
    await handler(makeReq(Buffer.alloc(0), {}, 'GET'), res as never)
    expect(res.statusCode).toBe(405)
  })
})
