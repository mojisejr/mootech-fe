// /ops tier administration — comp grant/revoke ของ member_subscription (ไม่มี payment row).
// PURE validate + column-scoped write (mirror lib/ops/packages.ts). ไม่ลบ history — supersede/expire เท่านั้น.
import { randomUUID } from 'node:crypto'
import { and, eq, sql } from 'drizzle-orm'
import { db as defaultDb } from '@/lib/db'
import { memberSubscription, memberPayment } from '@/lib/db/schema'
import { TIER_CODES } from '@/lib/v2/tier'

type Db = typeof defaultDb

export type TierEdit =
  | { action: 'grant'; userId: string; tierCode: 'PLUS' | 'PRO'; expireAt: string }
  | { action: 'revoke'; userId: string }
export type TierRefusal = { ok: false; reason: 'BAD_USER' | 'BAD_TIER' | 'BAD_DATE' | 'BAD_ACTION' }

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/** Validate one /ops tier form row. PURE — no DB. */
export function validateTierEdit(raw: {
  userId: unknown
  action: unknown
  tierCode?: unknown
  expireAt?: unknown
}): { ok: true; edit: TierEdit } | TierRefusal {
  const userId = typeof raw.userId === 'string' ? raw.userId.trim() : ''
  if (!userId) return { ok: false, reason: 'BAD_USER' }

  if (raw.action === 'revoke') return { ok: true, edit: { action: 'revoke', userId } }
  if (raw.action !== 'grant') return { ok: false, reason: 'BAD_ACTION' }

  const tierCode = typeof raw.tierCode === 'string' ? raw.tierCode.trim() : ''
  // /ops มอบได้เฉพาะ tier ที่จ่ายเงิน (PLUS/PRO); FREE = ใช้ revoke
  if (tierCode !== 'PLUS' && tierCode !== 'PRO') return { ok: false, reason: 'BAD_TIER' }
  if (!TIER_CODES.includes(tierCode)) return { ok: false, reason: 'BAD_TIER' }

  const expireAt = typeof raw.expireAt === 'string' ? raw.expireAt.trim() : ''
  if (!DATE_RE.test(expireAt) || Number.isNaN(Date.parse(expireAt))) return { ok: false, reason: 'BAD_DATE' }

  return { ok: true, edit: { action: 'grant', userId, tierCode, expireAt } }
}

const todayISO = () => new Date().toISOString().slice(0, 10)
const yesterdayISO = () => new Date(Date.now() - 86400000).toISOString().slice(0, 10)
const OPS_COMP_PACKAGE = 'OPS_COMP'

/**
 * Apply a tier edit.
 * grant: supersede live member_subscription rows (ACTIVE→REPLACED), insert a comp ACTIVE row
 *   (paymentId/v2PaymentId NULL, amountSatang 0), upsert the legacy member_payment shadow.
 * revoke: expire live member_subscription rows (ACTIVE→EXPIRED) + push member_payment.expire_at to the past
 *   (→ resolveSubscription answers FREE). Nothing is deleted (history kept).
 */
export async function applyTier(edit: TierEdit, db: Db = defaultDb): Promise<void> {
  if (edit.action === 'revoke') {
    await db
      .update(memberSubscription)
      .set({ status: 'EXPIRED' })
      .where(and(eq(memberSubscription.userId, edit.userId), eq(memberSubscription.status, 'ACTIVE')))
    await db
      .update(memberPayment)
      .set({ expireAt: yesterdayISO() })
      .where(eq(memberPayment.userId, edit.userId))
    return
  }

  const start = todayISO()
  await db.transaction(async (tx) => {
    await tx
      .update(memberSubscription)
      .set({ status: 'REPLACED' })
      .where(and(eq(memberSubscription.userId, edit.userId), eq(memberSubscription.status, 'ACTIVE')))
    await tx.insert(memberSubscription).values({
      id: randomUUID(),
      userId: edit.userId,
      tierCode: edit.tierCode,
      packageCode: OPS_COMP_PACKAGE,
      amountSatang: 0,
      startAt: start,
      expireAt: edit.expireAt,
      status: 'ACTIVE',
    })
    await tx
      .insert(memberPayment)
      .values({
        userId: edit.userId,
        planCode: 'MEMBER',
        packageCode: OPS_COMP_PACKAGE,
        createAt: start,
        startAt: start,
        expireAt: edit.expireAt,
      })
      .onConflictDoUpdate({
        target: memberPayment.userId,
        set: {
          planCode: 'MEMBER',
          packageCode: OPS_COMP_PACKAGE,
          startAt: start,
          expireAt: sql`GREATEST(${memberPayment.expireAt}, ${edit.expireAt})`,
        },
      })
  })
}
