// Deterministic tests for the AI Chat QuotaCard derivation (#mumate-ops-dashboard-pr56).
// deriveAiQuota is pure — no DB round-trip needed. The live query itself (fetchAiQuota) was
// verified manually against production 2026-07-14 (see PR description): 362 wallets, welcome
// 1086, purchased 18 (all PAYASUSE), granted 1104, remaining 407, used 697, 63%.
// Run: bun scripts/ops-pr56-ai-quota.test.ts   or: npx tsx scripts/ops-pr56-ai-quota.test.ts
import assert from 'node:assert/strict'
import { deriveAiQuota, WELCOME_CREDITS } from '../lib/ops/ai-usage'

let pass = 0
function t(name: string, fn: () => void) {
  try {
    fn()
    pass++
  } catch (e: any) {
    console.error(`✗ ${name}\n  ${e?.message ?? e}`)
    process.exitCode = 1
  }
}

function main() {
  t('matches the live production numbers verified 2026-07-14', () => {
    const q = deriveAiQuota(
      { walletCount: 362, purchasedTotal: 18, remaining: 407 },
      [{ plan: 'PAYASUSE', credits: 18 }],
    )
    assert.equal(q.welcome, 1086)
    assert.equal(q.granted, 1104)
    assert.equal(q.used, 697)
    assert.equal(q.remaining, 407)
    assert.equal(q.usagePercent, 63)
  })

  t('zero wallets (empty pool, e.g. fresh DB) -> 0% not NaN/divide-by-zero', () => {
    const q = deriveAiQuota({ walletCount: 0, purchasedTotal: 0, remaining: 0 }, [])
    assert.equal(q.welcome, 0)
    assert.equal(q.granted, 0)
    assert.equal(q.used, 0)
    assert.equal(q.usagePercent, 0)
  })

  t('remaining > granted (data anomaly) -> used clamps at 0, never negative', () => {
    // Should not happen under the real consume()-guarded formula, but the ops dashboard must not
    // show a negative "used" if the two source aggregates ever drift.
    const q = deriveAiQuota({ walletCount: 1, purchasedTotal: 0, remaining: 999 }, [])
    assert.equal(q.granted, 3) // walletCount(1) * WELCOME_CREDITS
    assert.equal(q.used, 0)
  })

  t('negative remaining (data anomaly) -> remaining clamps at 0, not shown negative', () => {
    const q = deriveAiQuota({ walletCount: 10, purchasedTotal: 0, remaining: -5 }, [])
    assert.equal(q.remaining, 0)
  })

  t('usagePercent never exceeds 100 even if used > granted was somehow possible', () => {
    // used is derived as max(0, granted-remaining) so it can't exceed granted in practice, but
    // the clamp in usagePercent is a second line of defense against a future refactor breaking
    // that invariant silently.
    const q = deriveAiQuota({ walletCount: 1, purchasedTotal: 0, remaining: 0 }, [])
    assert.ok(q.usagePercent <= 100)
  })

  t('WELCOME_CREDITS constant is 3, mirroring mootech-be wallet.util.ts', () => {
    assert.equal(WELCOME_CREDITS, 3)
  })

  t('purchasedByPlan passes through unchanged (multi-plan case)', () => {
    const q = deriveAiQuota(
      { walletCount: 5, purchasedTotal: 100, remaining: 50 },
      [
        { plan: 'PAYASUSE', credits: 80 },
        { plan: 'HOROSCOPE', credits: 20 },
      ],
    )
    assert.deepEqual(q.purchasedByPlan, [
      { plan: 'PAYASUSE', credits: 80 },
      { plan: 'HOROSCOPE', credits: 20 },
    ])
  })

  if (process.exitCode) {
    console.error(`\nops-pr56-ai-quota: FAILED (${pass} passed)`)
  } else {
    console.log(`ops-pr56-ai-quota: all ${pass} passed ✓`)
  }
}

main()
