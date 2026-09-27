// lib/storage/friend-photo.ts — store a friend's photo in Supabase Storage (CIEL mumate-be-retirement-001 slice 1f).
//
// v2's add-friend sheet (features/v2-service/components/AddFriendSheet.tsx) uploads a photo and stores the URL
// it gets back as the friend's picture_url. That upload used to be mootech-be POST /object-storage/upload-file.
// Parity target: mootech-be src/object-storage/object-storage.service.ts:62-85 (uploadFile) + :107-127
// (putObject) + src/config/supabase/configuration.ts, read at 0705378.
//
// WHAT IS KEPT EXACTLY
//   • the same Supabase project and bucket, named by the SAME env names the BE reads
//     (SUPABASE_PROJECT_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_STORAGE_BUCKET — bucket defaults to 'mootech'
//     as the BE's configuration.ts does). The owner copies the three values from the BE's environment.
//   • the key shape: mumate/profile/<YYYYMMDDHHmmss, Asia/Bangkok>_<random>.<ext>, .jpg for image/jpeg and
//     .png for image/png, stored with the file's own content-type.
//   • the answer: { s3_key: <public URL> } — the public URL, not the key, exactly as the BE's supabase-js
//     getPublicUrl() built it: <project>/storage/v1/object/public/<bucket>/<key>. Every stored picture_url
//     from the BE era has this shape, so old and new rows render the same way.
//
// WHAT IS DELIBERATELY DIFFERENT
//   • images only: jpeg, png, webp, checked by the file's leading bytes as well as its declared type. The BE
//     stored ANY type into a PUBLIC bucket (and named a webp `…_123.image/webp`, a key with a slash in it).
//   • 4 MB, not 50 MB. Vercel refuses a function request body over 4.5 MB before our code runs, so a larger
//     limit here would be a number nothing can reach. The sheet shrinks a photo before sending it
//     (lib/v2/shrink-image.ts), so an ordinary phone photo arrives at a few hundred KB.
//   • the random part is 12 hex characters from crypto, not Math.random() 0-999, and the upload never
//     overwrites. The BE used upsert: true with 1,000 possible suffixes per second, so two uploads in the same
//     second could silently replace each other's photo.
//   • a failed upload is an error. The BE logged it and still answered with the URL of a file that was never
//     written, so the friend was saved with a broken picture.
//
// Talks to the Storage REST API with fetch — the same request supabase-js sends — so no new dependency.
// 🔴 SERVER ONLY. SUPABASE_SERVICE_ROLE_KEY bypasses every RLS policy in the project. It is read here, sent
//    only to SUPABASE_PROJECT_URL, and never logged or returned. Never give it a NEXT_PUBLIC_ name.
import { randomBytes } from 'node:crypto'
import { bkkTimestamp } from '@/lib/usage-core'

export const FRIEND_PHOTO_MAX_BYTES = 4 * 1024 * 1024

export const FRIEND_PHOTO_TYPES = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
} as const
export type FriendPhotoType = keyof typeof FRIEND_PHOTO_TYPES

export function isFriendPhotoType(t: string): t is FriendPhotoType {
  return Object.prototype.hasOwnProperty.call(FRIEND_PHOTO_TYPES, t)
}

/** Does the content really start like the type it claims? (JPEG FF D8 FF · PNG 89 50 4E 47 0D 0A 1A 0A · WEBP RIFF….WEBP) */
export function bytesMatchType(buf: Uint8Array, type: FriendPhotoType): boolean {
  const at = (i: number, bytes: number[]) => bytes.every((b, k) => buf[i + k] === b)
  switch (type) {
    case 'image/jpeg':
      return buf.length >= 3 && at(0, [0xff, 0xd8, 0xff])
    case 'image/png':
      return buf.length >= 8 && at(0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    case 'image/webp':
      return buf.length >= 12 && at(0, [0x52, 0x49, 0x46, 0x46]) && at(8, [0x57, 0x45, 0x42, 0x50])
  }
}

/** mumate/profile/<YYYYMMDDHHmmss Bangkok>_<12 hex>.<ext> — the BE's prefix and clock, a wider random part. */
export function friendPhotoKey(type: FriendPhotoType, now: Date = new Date(), rand: string = randomBytes(6).toString('hex')): string {
  const stamp = bkkTimestamp(now).replace(/[-: ]/g, '')
  return `mumate/profile/${stamp}_${rand}.${FRIEND_PHOTO_TYPES[type]}`
}

export type StorageConfig = { projectUrl: string; serviceRoleKey: string; bucket: string }

/** The three values, or null when the deployment has not been given them (the route answers 503). */
export function readStorageConfig(): StorageConfig | null {
  const projectUrl = (process.env.SUPABASE_PROJECT_URL ?? '').trim().replace(/\/+$/, '')
  const serviceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim()
  // Same default as mootech-be src/config/supabase/configuration.ts.
  const bucket = (process.env.SUPABASE_STORAGE_BUCKET ?? '').trim() || 'mootech'
  if (!/^https?:\/\/[^/]+/i.test(projectUrl) || !serviceRoleKey) return null
  return { projectUrl, serviceRoleKey, bucket }
}

/** supabase-js getPublicUrl(): encodeURI(`${url}/storage/v1/object/public/${bucket}/${key}`). */
export function publicUrlFor(cfg: StorageConfig, key: string): string {
  return encodeURI(`${cfg.projectUrl}/storage/v1/object/public/${cfg.bucket}/${key}`)
}

export type PutOutcome = { ok: true; publicUrl: string; key: string } | { ok: false; status: number | null }

/**
 * Upload one object. The request is what supabase-js storage.from(bucket).upload(key, body, { contentType })
 * sends — POST /storage/v1/object/<bucket>/<key>, both auth headers carrying the key, cache-control
 * max-age=3600 (its default) — except x-upsert is false: an existing key is a refusal, never a replacement.
 */
export async function putFriendPhoto(
  cfg: StorageConfig,
  body: Uint8Array,
  type: FriendPhotoType,
  now: Date = new Date(),
  fetchImpl: typeof fetch = fetch,
): Promise<PutOutcome> {
  const key = friendPhotoKey(type, now)
  try {
    const r = await fetchImpl(`${cfg.projectUrl}/storage/v1/object/${encodeURIComponent(cfg.bucket)}/${key}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cfg.serviceRoleKey}`,
        apikey: cfg.serviceRoleKey,
        'Content-Type': type,
        'cache-control': 'max-age=3600',
        'x-upsert': 'false',
      },
      body: body as unknown as BodyInit,
    })
    if (!r.ok) return { ok: false, status: r.status }
    return { ok: true, publicUrl: publicUrlFor(cfg, key), key }
  } catch {
    return { ok: false, status: null }
  }
}
