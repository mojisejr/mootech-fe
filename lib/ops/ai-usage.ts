// AI Chat QuotaCard data source (#mumate-ops-dashboard-pr56 Step 3). Reads the SAME wallet
// table mootech-be's chat credit system already maintains (member_pay_as_use) — no new
// mootech-be endpoint needed. This is a correction of an earlier (wrong) consult answer: at the
// time I'd only checked the runtime fetch path (lib/credit/wallet-client.ts -> NestJS
// /ai/balance/:userId, per-user only) and concluded wallet data wasn't queryable from here.
// Reading mootech-be's actual migration + service code (2026-06-26-wallet-balance.sql,
// member-pay-as-use.service.ts) shows `balance`/`total` are plain columns in the same Supabase
// DB, decrement-only, maintained by real business logic — directly aggregatable.
//
// IMPORTANT — this pool EXCLUDES active MEMBER-plan users entirely. mootech-be's ai.service.ts
// (`resolveAiBalance`) gives active members `{ unlimited: true, balance: 0 }` and never touches
// this wallet for them (`consume()` is only called for the metered/non-member path). So
// `member_pay_as_use` already represents exactly "the metered pool" — welcome-grant + purchased
// credits for non-member users — which is what "AI Chat capacity" should mean here. It does NOT
// mean "all AI chat usage system-wide" (active members chat for free, outside this pool).
import { eq, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { memberPayAsUse, logMemberPayAsUse, payment } from '@/lib/db/schema'

// Mirrors WELCOME_CREDITS in mootech-be/src/member-pay-as-use/wallet.util.ts. One-time welcome
// grant baked into every wallet row at creation (see member-pay-as-use.service.ts
// createMemberPayAsUse / migration 2026-06-26-wallet-balance.sql) — not itself a DB column.
const WELCOME_CREDITS = 3

export type AiQuotaBreakdown = {
  welcome: number
  purchasedByPlan: Array<{ plan: string; credits: number }>
  granted: number
  used: number
  remaining: number
  usagePercent: number
}

export async function fetchAiQuota(): Promise<AiQuotaBreakdown> {
  const [walletRows, purchaseRows] = await Promise.all([
    db
      .select({
        walletCount: sql<number>`count(*)`,
        purchasedTotal: sql<number>`coalesce(sum(${memberPayAsUse.total}), 0)`,
        remaining: sql<number>`coalesce(sum(${memberPayAsUse.balance}), 0)`,
      })
      .from(memberPayAsUse),
    db
      .select({ plan: payment.paymentPlan, credits: sql<number>`coalesce(sum(${logMemberPayAsUse.total}), 0)` })
      .from(logMemberPayAsUse)
      .innerJoin(payment, eq(payment.id, logMemberPayAsUse.paymentId))
      .groupBy(payment.paymentPlan),
  ])

  const walletCount = Number(walletRows[0]?.walletCount ?? 0)
  const remaining = Number(walletRows[0]?.remaining ?? 0)
  const welcome = walletCount * WELCOME_CREDITS
  const purchasedTotal = Number(walletRows[0]?.purchasedTotal ?? 0)
  const granted = welcome + purchasedTotal
  const used = Math.max(0, granted - remaining)

  return {
    welcome,
    purchasedByPlan: purchaseRows.map((r) => ({ plan: r.plan, credits: Number(r.credits) })),
    granted,
    used,
    remaining,
    usagePercent: granted > 0 ? Math.round((used / granted) * 100) : 0,
  }
}
