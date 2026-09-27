// POST /api/object-storage/upload-file — store a friend photo, answer { s3_key: <public URL> }.
// CIEL mumate-be-retirement-001 slice 1f. Was mootech-be POST /object-storage/upload-file; the path is kept so
// the rollback is the one-line flip in constants/api/endpoint.ts (localApi → backendURLGenerator), like every
// other migrated endpoint. Callers: v2 AddFriendSheet (friend photo) and v1 modal-image-crop (v1 is being
// made unreachable in slice 2; it sends the same multipart shape and reads the same `s3_key`).
//
// Request: multipart/form-data with ONE part named `file` (the BE's FileFieldsInterceptor [{ name: 'file' }]).
// Storage, key shape, the answer, and every deliberate difference from the BE: lib/storage/friend-photo.ts.
//
// 🔴 SIGNED-IN CALLERS ONLY. The BE route had no caller check at all: anyone who could reach it could write
//    any file into a public bucket under our domain's storage. Here the session is resolved BEFORE the body is
//    read, so an anonymous request cannot even make the server buffer its upload.
//
// 🔴 LIMITS, in the order they bite: Content-Length over the cap → 413 without reading; the stream itself is
//    cut at the cap (a lying or absent Content-Length cannot get past it); then the part must be one of
//    jpeg/png/webp by declared type AND by its first bytes (415), non-empty, and within 4 MB (413).
import type { NextApiRequest, NextApiResponse } from 'next'
import { resolveSessionUserId } from '@/lib/v2/resolve-user'
import {
  FRIEND_PHOTO_MAX_BYTES,
  bytesMatchType,
  isFriendPhotoType,
  putFriendPhoto,
  readStorageConfig,
} from '@/lib/storage/friend-photo'

// The body is a stream we read (and cap) ourselves; Next's JSON/urlencoded parser must not touch it.
export const config = { api: { bodyParser: false } }

// The whole multipart body may carry the file plus boundaries and part headers.
const MAX_BODY_BYTES = FRIEND_PHOTO_MAX_BYTES + 64 * 1024

class TooLarge extends Error {}

async function readCapped(req: NextApiRequest, cap: number): Promise<Buffer> {
  const chunks: Buffer[] = []
  let total = 0
  for await (const chunk of req as AsyncIterable<Buffer | string>) {
    const b = typeof chunk === 'string' ? Buffer.from(chunk) : chunk
    total += b.length
    if (total > cap) throw new TooLarge()
    chunks.push(b)
  }
  return Buffer.concat(chunks)
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const who = await resolveSessionUserId(req, res)
  if (!who.ok) return res.status(who.status).json({ error: who.error })

  const contentType = String(req.headers['content-type'] ?? '')
  if (!/^multipart\/form-data\b/i.test(contentType)) {
    return res.status(415).json({ error: 'expected multipart/form-data with a `file` part' })
  }
  const declared = Number(req.headers['content-length'] ?? NaN)
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
    return res.status(413).json({ error: 'file too large (max 4 MB)' })
  }

  // Checked before reading the body: a deployment without storage should not buffer uploads it cannot keep.
  const cfg = readStorageConfig()
  if (!cfg) return res.status(503).json({ error: 'storage not configured' })

  let raw: Buffer
  try {
    raw = await readCapped(req, MAX_BODY_BYTES)
  } catch (e) {
    if (e instanceof TooLarge) return res.status(413).json({ error: 'file too large (max 4 MB)' })
    return res.status(400).json({ error: 'could not read the upload' })
  }

  // Node's own multipart parser (undici's Response.formData) — no new dependency.
  let file: FormDataEntryValue | null
  try {
    const form = await new Response(raw as unknown as BodyInit, { headers: { 'content-type': contentType } }).formData()
    file = form.get('file')
  } catch {
    return res.status(400).json({ error: 'malformed multipart body' })
  }
  if (!file || typeof file === 'string') return res.status(400).json({ error: 'file is required' })

  const type = (file.type || '').toLowerCase()
  if (!isFriendPhotoType(type)) return res.status(415).json({ error: 'only JPEG, PNG or WEBP images are accepted' })
  if (file.size === 0) return res.status(400).json({ error: 'file is empty' })
  if (file.size > FRIEND_PHOTO_MAX_BYTES) return res.status(413).json({ error: 'file too large (max 4 MB)' })
  const bytes = new Uint8Array(await file.arrayBuffer())
  if (!bytesMatchType(bytes, type)) return res.status(415).json({ error: 'file content does not match its image type' })

  const out = await putFriendPhoto(cfg, bytes, type)
  // The storage status is not relayed: it is ours to read in the logs, not the caller's. Status only — never
  // the key, the URL or the headers.
  if (!out.ok) {
    console.error('[upload-file] storage refused the upload', { status: out.status })
    return res.status(502).json({ error: 'upload failed' })
  }
  return res.status(200).json({ s3_key: out.publicUrl })
}
