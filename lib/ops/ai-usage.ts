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
export const WELCOME_CREDITS = 3

export type AiQuotaBreakdown = {
  welcome: number
  purchasedByPlan: Array<{ plan: string; credits: number }>
  granted: number
  used: number
  remaining: number
  usagePercent: number
}

type WalletTotals = { walletCount: number; purchasedTotal: number; remaining: number }
type PurchaseRow = { plan: string; credits: number }

// Pure derivation, isolated from the DB round-trip so the edge cases (no wallets yet, a
// remaining balance that exceeds granted from a data anomaly) are unit-testable without a live
// connection. `used` clamps at 0 (never negative) and `usagePercent` clamps at 100 (never >100%
// even if `remaining` is inconsistent with `granted` for some row).
export function deriveAiQuota(wallet: WalletTotals, purchases: PurchaseRow[]): AiQuotaBreakdown {
  const welcome = wallet.walletCount * WELCOME_CREDITS
  const granted = welcome + wallet.purchasedTotal
  const used = Math.max(0, granted - wallet.remaining)
  const remaining = Math.max(0, wallet.remaining)

  return {
    welcome,
    purchasedByPlan: purchases,
    granted,
    used,
    remaining,
    usagePercent: granted > 0 ? Math.min(100, Math.round((used / granted) * 100)) : 0,
  }
}

export async function fetchAiQuota(): Promise<AiQuotaBreakdown> {
  // Sequential, not Promise.all: running these two concurrently reproducibly hung indefinitely
  // against the shared `max: 1` connection (lib/db/index.ts) — isolated and confirmed during
  // browser-truth testing (each query alone: ~500ms / ~40ms; together via Promise.all: hangs
  // past 40s). Root cause not fully understood (client-protocol pipelining on a single physical
  // connection?), but every other ops query pattern in this codebase already uses Promise.all
  // safely, so this is likely specific to these two shapes together — sequential is the safe fix.
  const walletRows = await db
    .select({
      walletCount: sql<number>`count(*)`,
      purchasedTotal: sql<number>`coalesce(sum(${memberPayAsUse.total}), 0)`,
      remaining: sql<number>`coalesce(sum(${memberPayAsUse.balance}), 0)`,
    })
    .from(memberPayAsUse)
  const purchaseRows = await db
    .select({ plan: payment.paymentPlan, credits: sql<number>`coalesce(sum(${logMemberPayAsUse.total}), 0)` })
    .from(logMemberPayAsUse)
    .innerJoin(payment, eq(payment.id, logMemberPayAsUse.paymentId))
    .groupBy(payment.paymentPlan)

  return deriveAiQuota(
    {
      walletCount: Number(walletRows[0]?.walletCount ?? 0),
      purchasedTotal: Number(walletRows[0]?.purchasedTotal ?? 0),
      remaining: Number(walletRows[0]?.remaining ?? 0),
    },
    purchaseRows.map((r) => ({ plan: r.plan, credits: Number(r.credits) })),
  )
}
