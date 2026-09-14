// lib/ops/discounts.ts — CRUD "โค้ดส่วนลด" (discount_code) จากหน้า /ops (#2 คูปอง Phase 1 · ซินแสนุ้ย 2026-09-14).
//
// เลนส่วนลดเงินมีครบแล้ว (rules.ts / repo.ts / preview-flow / charge-flow / discount_redemption / payment_quote):
// โค้ดถูก validate + คิดส่วนลด + จองโควตา atomically ตอน checkout. ที่ขาดคือ "หน้าสร้างโค้ด" เท่านั้น — ไฟล์นี้เติมส่วนนั้น.
// value: PERCENT → เปอร์เซ็นต์ (10 = 10%) ; FIXED → satang. maxDiscountSatang = เพดานลด (เฉพาะ PERCENT). ตรงกับ rules.ts.
import { randomUUID } from 'node:crypto'
import { desc, eq, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { discountCode } from '@/lib/db/schema'

export type OpsDiscount = {
  id: string
  code: string
  kind: 'PERCENT' | 'FIXED'
  value: number
  maxDiscountSatang: number | null
  appliesTo: string[]
  startsAt: string | null
  endsAt: string | null
  maxUseTotal: number | null
  maxUsePerUser: number | null
  status: string
  usedCount: number
  createdAt: string
}

const iso = (d: unknown): string | null => (d ? new Date(d as string).toISOString() : null)

export async function listDiscounts(): Promise<OpsDiscount[]> {
  const rows = await db.select().from(discountCode).orderBy(desc(discountCode.createdAt)).limit(300)
  return rows.map((r) => ({
    id: r.id,
    code: r.code,
    kind: r.kind as 'PERCENT' | 'FIXED',
    value: r.value,
    maxDiscountSatang: r.maxDiscountSatang ?? null,
    appliesTo: Array.isArray(r.appliesTo) ? r.appliesTo : [],
    startsAt: iso(r.startsAt),
    endsAt: iso(r.endsAt),
    maxUseTotal: r.maxUseTotal ?? null,
    maxUsePerUser: r.maxUsePerUser ?? null,
    status: r.status,
    usedCount: r.usedCount,
    createdAt: iso(r.createdAt) ?? '',
  }))
}

export type Validated = {
  code: string
  kind: 'PERCENT' | 'FIXED'
  value: number
  maxDiscountSatang: number | null
  appliesTo: string[]
  startsAt: Date | null
  endsAt: Date | null
  maxUseTotal: number | null
  maxUsePerUser: number | null
}

function parseDate(v: unknown): Date | null | 'invalid' {
  if (v == null || v === '') return null
  if (typeof v !== 'string') return 'invalid'
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? 'invalid' : d
}
function parseCount(v: unknown): number | null | 'invalid' {
  if (v == null || v === '') return null
  const n = Number(v)
  if (!Number.isFinite(n) || n < 1) return 'invalid'
  return Math.round(n)
}

/** ตรวจ input จากฟอร์ม /ops → ค่าที่พร้อมเขียน DB. maxDiscountBaht/value เป็น "บาท" ในฟอร์ม แปลงเป็น satang ที่นี่. */
export function validateCreate(input: Record<string, unknown>): { ok: true; value: Validated } | { ok: false; reason: string } {
  const code = typeof input.code === 'string' ? input.code.trim() : ''
  if (!/^[A-Za-z0-9_-]{2,40}$/.test(code)) return { ok: false, reason: 'โค้ดต้องเป็น a-z 0-9 _ - ยาว 2-40 ตัว' }
  const kind = input.kind === 'FIXED' ? 'FIXED' : input.kind === 'PERCENT' ? 'PERCENT' : null
  if (!kind) return { ok: false, reason: 'ชนิดต้องเป็น PERCENT หรือ FIXED' }
  const rawValue = Number(input.value)
  if (!Number.isFinite(rawValue) || rawValue <= 0) return { ok: false, reason: 'มูลค่าต้องมากกว่า 0' }

  let value: number
  let maxDiscountSatang: number | null = null
  if (kind === 'PERCENT') {
    value = Math.round(rawValue)
    // ไม่ให้ลด 100% (rules.ts MIN_CHARGE_SATANG=2000 กันยอดเป็น 0) — เพดาน 90%
    if (value < 1 || value > 90) return { ok: false, reason: 'ส่วนลดเปอร์เซ็นต์ต้อง 1-90' }
    const mdb = Number(input.maxDiscountBaht)
    maxDiscountSatang = Number.isFinite(mdb) && mdb > 0 ? Math.round(mdb * 100) : null
  } else {
    value = Math.round(rawValue * 100) // บาท → satang
    if (value < 100) return { ok: false, reason: 'ส่วนลดแบบจำนวนเงินต้อง ≥ 1 บาท' }
  }

  const appliesTo = Array.isArray(input.appliesTo)
    ? input.appliesTo.filter((x): x is string => typeof x === 'string' && x.trim() !== '').map((x) => x.trim())
    : []
  const startsAt = parseDate(input.startsAt)
  const endsAt = parseDate(input.endsAt)
  if (startsAt === 'invalid' || endsAt === 'invalid') return { ok: false, reason: 'วันที่ต้องเป็นรูปแบบที่ถูกต้อง หรือเว้นว่าง' }
  if (startsAt && endsAt && startsAt.getTime() >= endsAt.getTime()) return { ok: false, reason: 'วันเริ่มต้องก่อนวันหมดอายุ' }
  const maxUseTotal = parseCount(input.maxUseTotal)
  const maxUsePerUser = parseCount(input.maxUsePerUser)
  if (maxUseTotal === 'invalid' || maxUsePerUser === 'invalid') return { ok: false, reason: 'จำนวนครั้งต้อง ≥ 1 หรือเว้นว่าง (ไม่จำกัด)' }

  return {
    ok: true,
    value: { code, kind, value, maxDiscountSatang, appliesTo, startsAt: startsAt || null, endsAt: endsAt || null, maxUseTotal: maxUseTotal || null, maxUsePerUser: maxUsePerUser || null },
  }
}

/** โค้ดซ้ำไหม (lower(code) UNIQUE — index uq_discount_code_lower_code) */
export async function isCodeTaken(code: string): Promise<boolean> {
  const r = await db.execute(sql`SELECT 1 FROM discount_code WHERE lower(code) = lower(${code}) LIMIT 1`)
  const arr = (Array.isArray(r) ? r : (r as { rows?: unknown[] }).rows ?? []) as unknown[]
  return arr.length > 0
}

export async function createDiscount(v: Validated, createdBy: string | null): Promise<{ ok: true; id: string } | { ok: false; reason: string }> {
  if (await isCodeTaken(v.code)) return { ok: false, reason: 'มีโค้ดนี้อยู่แล้ว' }
  const id = randomUUID()
  await db.insert(discountCode).values({
    id,
    code: v.code,
    kind: v.kind,
    value: v.value,
    maxDiscountSatang: v.maxDiscountSatang,
    appliesTo: v.appliesTo,
    startsAt: v.startsAt,
    endsAt: v.endsAt,
    maxUseTotal: v.maxUseTotal,
    maxUsePerUser: v.maxUsePerUser,
    status: 'ACTIVE',
    createdBy: createdBy ?? null,
  })
  return { ok: true, id }
}

export async function setStatus(id: string, status: 'ACTIVE' | 'PAUSED' | 'EXPIRED'): Promise<boolean> {
  const res = await db.update(discountCode).set({ status }).where(eq(discountCode.id, id)).returning({ id: discountCode.id })
  return res.length > 0
}
