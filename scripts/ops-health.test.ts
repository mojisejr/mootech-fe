// Deterministic tests for System Health status mapping (#mumate-ops-dashboard-phase1 Step 2).
// Mocks fetch — no real Vercel calls. The Vercel response shape is from the public REST API docs (the actual
// VERCEL_TOKEN runtime value is a Vercel "Sensitive" env var — hidden from local `vercel env pull`/CLI by
// design, verified separately via a real Preview deploy, not here).
//
// CIEL mumate-be-retirement-001 slice 2c, DoD V4: /ops overall health no longer depends on Render. The five
// Render mapping tests that lived here went with fetchRenderHealth; the two below replace them and fail if
// the Render read, or the BE card's status in the overall roll-up, comes back.
// Run: npx vitest run scripts/ops-health.test.ts
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fetchSystemHealth, fetchVercelHealth, overallHealth } from '../lib/ops/health'
import { test as t } from 'vitest'

function withMockFetch<T>(impl: typeof fetch, fn: () => Promise<T>): Promise<T> {
  const original = globalThis.fetch
  globalThis.fetch = impl
  return fn().finally(() => {
    globalThis.fetch = original
  })
}

await t('V4 · System Health asks Vercel only — never Render, even with a Render key in the environment', async () => {
    process.env.VERCEL_TOKEN = 'test-token'
    process.env.RENDER_API_KEY = 'left-over-on-a-platform'
    // on Vercel (the platform sets VERCEL); off Vercel the card is the container's /api/health — scripts/do-ops-launch.test.ts
    process.env.VERCEL = '1'
    const asked: string[] = []
    try {
      await withMockFetch(
        (async (input: RequestInfo | URL) => {
          asked.push(String(input))
          return new Response(JSON.stringify({ deployments: [{ readyState: 'READY', created: 1752451200000 }] }), {
            status: 200,
          })
        }) as typeof fetch,
        async () => {
          const health = await fetchSystemHealth()
          assert.deepEqual(Object.keys(health), ['fe'])
          assert.equal(health.fe.status, 'ok')
        },
      )
    } finally {
      delete process.env.RENDER_API_KEY
      delete process.env.VERCEL
    }
    assert.equal(asked.length, 1, `expected one request, got ${asked.join(', ')}`)
    assert.match(asked[0], /^https:\/\/api\.vercel\.com\//)
    assert.equal(asked.some((u) => /render\.com/.test(u)), false)
  })

  await t('V4 · /ops folds FE and activity into overall health, and no BE card', () => {
    const src = readFileSync('pages/ops/index.tsx', 'utf8')
    assert.match(src, /overallHealth\(\[health\.fe\.status, activity\.status\]\)/)
    assert.equal(/health\.be\b/.test(src), false, 'pages/ops/index.tsx still reads health.be')
    assert.equal(/process\.env\.RENDER_API_KEY|api\.render\.com/.test(readFileSync('lib/ops/health.ts', 'utf8')), false)
  })

  await t('Vercel: READY -> ok, ERROR -> bad, BUILDING -> warn', async () => {
    process.env.VERCEL_TOKEN = 'test-token'
    for (const [state, expected] of [
      ['READY', 'ok'],
      ['ERROR', 'bad'],
      ['BUILDING', 'warn'],
    ] as const) {
      await withMockFetch(
        (async () =>
          new Response(JSON.stringify({ deployments: [{ readyState: state, created: 1752451200000 }] }), {
            status: 200,
          })) as typeof fetch,
        async () => {
          const result = await fetchVercelHealth()
          assert.equal(result.status, expected, `state ${state} should map to ${expected}`)
        },
      )
    }
  })

  await t('overallHealth: bad beats warn beats unknown beats ok', () => {
    assert.equal(overallHealth(['ok', 'ok']), 'ok')
    assert.equal(overallHealth(['ok', 'warn']), 'warn')
    assert.equal(overallHealth(['ok', 'warn', 'bad']), 'bad')
    assert.equal(overallHealth(['ok', 'unknown']), 'unknown')
  })
