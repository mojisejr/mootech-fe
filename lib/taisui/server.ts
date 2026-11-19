// ปีชง 2570 — server helpers shared by the page and its API routes. Member data never leaves the server
// except as the reading itself; logs carry only error classes.
import type { NextApiRequest } from 'next'
import { sql } from 'drizzle-orm'

import { db } from '@/lib/db'
import { baziFetch } from '@/lib/bazi/fetch'
import { mergeEngineBirth } from '@/lib/bazi-bridge/engine-birth'
import { isBirthProfileComplete, userRowToFeCalcInput, type UserBirthRow } from '@/lib/bazi-bridge/input'
import { REFERRAL_CODE_RE } from '@/lib/v2/referral-code'
import { ELEMENT_TH, animalImage, animalTh } from '@/features/v2-taisui/content/animals'
import type { TaisuiFacts } from './types'

export type EngineBirth = { birthDate: string; birthTime: string | null; gender: 'male' | 'female' }

const rowsOf = (r: unknown): Array<Record<string, unknown>> => (Array.isArray(r) ? r : ((r as { rows?: Array<Record<string, unknown>> })?.rows ?? []))
const base = () => process.env.BAZI_BASE_URL || 'http://localhost:3000'

export const DOB_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/
export const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/

/** A typed birth from the sheet, or null when malformed. Gregorian date; time null = unknown. */
export function parseBirth(input: unknown): EngineBirth | null {
  if (!input || typeof input !== 'object') return null
  const b = input as Record<string, unknown>
  if (typeof b.date !== 'string' || !DOB_RE.test(b.date)) return null
  const year = +b.date.slice(0, 4)
  if (year < 1900 || year > new Date().getFullYear()) return null
  if (b.time !== null && (typeof b.time !== 'string' || !TIME_RE.test(b.time))) return null
  if (b.gender !== 'male' && b.gender !== 'female') return null
  return { birthDate: b.date, birthTime: b.time as string | null, gender: b.gender }
}

function toEngineBirth(row: UserBirthRow): EngineBirth {
  const fe = userRowToFeCalcInput(row)
  const time = typeof fe.time === 'string' && TIME_RE.test(fe.time.slice(0, 5)) ? fe.time.slice(0, 5) : null
  return { birthDate: String(fe.dob ?? '').slice(0, 10), birthTime: time, gender: String(fe.gender ?? '').toLowerCase() === 'female' ? 'female' : 'male' }
}

/** The member's saved birth: 'none' without a row, 'incomplete' when dob or gender is missing. */
export async function savedBirth(userId: string): Promise<EngineBirth | 'none' | 'incomplete'> {
  const row = rowsOf(await db.execute(sql`SELECT * FROM "user" WHERE user_id = ${userId} LIMIT 1`))[0] as UserBirthRow | undefined
  if (!row) return 'none'
  if (!isBirthProfileComplete(row)) return 'incomplete'
  return toEngineBirth(await mergeEngineBirth(userId, row))
}

export type SenderInfo = { name: string; animal: string; image: string; birth: EngineBirth | null }

/** The red-packet sender, looked up by referral code on the server: first name and year animal only. */
export async function senderByCode(code: string): Promise<SenderInfo | null> {
  if (!REFERRAL_CODE_RE.test(code)) return null
  const owner = rowsOf(await db.execute(sql`SELECT anon_id FROM "bazi_referral_code" WHERE code = ${code} LIMIT 1`))[0]
  const anonId = typeof owner?.anon_id === 'string' ? owner.anon_id : ''
  if (!anonId) return null
  const row = rowsOf(await db.execute(sql`SELECT * FROM "user" WHERE user_id = ${anonId} LIMIT 1`))[0] as (UserBirthRow & { name?: string | null }) | undefined
  const first = String(row?.name ?? '').trim().split(/\s+/)[0] || 'เพื่อน'
  if (!row || !isBirthProfileComplete(row)) return { name: first, animal: '', image: '/images/v2/mascot/personas/mu/greet.png', birth: null }
  const birth = toEngineBirth(await mergeEngineBirth(anonId, row))
  const facts = await yearFactsFor(birth)
  const year = facts?.pillars.find((p) => p.key === 'year')
  if (!year) return { name: first, animal: '', image: '/images/v2/mascot/personas/mu/greet.png', birth }
  const el = ELEMENT_TH[year.element] ?? ''
  return { name: first, animal: animalTh(year.branch), image: animalImage(year.branch, el), birth }
}

export async function yearFactsFor(birth: EngineBirth, partner?: EngineBirth | null): Promise<TaisuiFacts | null> {
  const res = await baziFetch(`${base()}/api/taisui`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ birth, ...(partner ? { partner } : {}) }),
    signal: AbortSignal.timeout(8000),
  })
  if (!res.ok) return null
  return (await res.json()) as TaisuiFacts
}

export async function baziJson(path: string, init?: RequestInit): Promise<{ status: number; body: unknown }> {
  const res = await baziFetch(`${base()}${path}`, { ...init, signal: AbortSignal.timeout(8000) })
  return { status: res.status, body: await res.json().catch(() => ({})) }
}

/** The request comes from this site (same check as the public calculator). */
export function sameOrigin(req: NextApiRequest): boolean {
  const origin = req.headers.origin
  const host = req.headers.host
  if (!origin || !host) return false
  try { return new URL(origin).host === host } catch { return false }
}
