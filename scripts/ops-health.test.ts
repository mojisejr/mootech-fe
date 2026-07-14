// Deterministic tests for System Health status mapping (#mumate-ops-dashboard-phase1 Step 2).
// Mocks fetch — no real Render/Vercel calls. Response shapes are verified live: Render via the
// Render MCP server against the real account, Vercel via the public REST API docs (the actual
// VERCEL_TOKEN/RENDER_API_KEY runtime values are Vercel "Sensitive" env vars — hidden from local
// `vercel env pull`/CLI by design, verified separately via a real Preview deploy, not here).
// Run: bun scripts/ops-health.test.ts   or: npx tsx scripts/ops-health.test.ts
import assert from 'node:assert/strict'
import { fetchRenderHealth, fetchVercelHealth, overallHealth } from '../lib/ops/health'

let pass = 0
async function t(name: string, fn: () => void | Promise<void>) {
  try {
    await fn()
    pass++
  } catch (e: any) {
    console.error(`✗ ${name}\n  ${e?.message ?? e}`)
    process.exitCode = 1
  }
}

function withMockFetch<T>(impl: typeof fetch, fn: () => Promise<T>): Promise<T> {
  const original = globalThis.fetch
  globalThis.fetch = impl
  return fn().finally(() => {
    globalThis.fetch = original
  })
}

async function main() {
  await t('Render: unconfigured key -> unknown, no fetch attempted', async () => {
    delete process.env.RENDER_API_KEY
    const result = await fetchRenderHealth()
    assert.equal(result.status, 'unknown')
  })

  await t('Render: "live" latest deploy (unwrapped {deploy:{...}} shape) -> ok', async () => {
    process.env.RENDER_API_KEY = 'test-key'
    await withMockFetch(
      (async () =>
        new Response(
          JSON.stringify([{ deploy: { status: 'live', finishedAt: '2026-07-14T02:00:00Z' } }]),
          { status: 200 },
        )) as typeof fetch,
      async () => {
        const result = await fetchRenderHealth()
        assert.equal(result.status, 'ok')
      },
    )
  })

  await t('Render: flat (unwrapped) shape also works — defensive parse handles either', async () => {
    process.env.RENDER_API_KEY = 'test-key'
    await withMockFetch(
      (async () => new Response(JSON.stringify([{ status: 'build_in_progress' }]), { status: 200 })) as typeof fetch,
      async () => {
        const result = await fetchRenderHealth()
        assert.equal(result.status, 'warn')
      },
    )
  })

  await t('Render: build_failed -> bad', async () => {
    process.env.RENDER_API_KEY = 'test-key'
    await withMockFetch(
      (async () => new Response(JSON.stringify([{ deploy: { status: 'build_failed' } }]), { status: 200 })) as typeof fetch,
      async () => {
        const result = await fetchRenderHealth()
        assert.equal(result.status, 'bad')
      },
    )
  })

  await t('Render: non-200 API response -> bad, does not throw', async () => {
    process.env.RENDER_API_KEY = 'test-key'
    await withMockFetch(
      (async () => new Response('{}', { status: 401 })) as typeof fetch,
      async () => {
        const result = await fetchRenderHealth()
        assert.equal(result.status, 'bad')
      },
    )
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

  if (process.exitCode) {
    console.error(`\nops-health: FAILED (${pass} passed)`)
  } else {
    console.log(`ops-health: all ${pass} passed ✓`)
  }
}

main()
